using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using Melearn.Domain.Accounts;

namespace Melearn.Application.Accounts;

public sealed record SessionIssue(Account Account, string Secret, DateTimeOffset ExpiresAt);

public sealed class AccountService(IAccountStore store, ILocalPassword passwords, TimeProvider clock)
{
    public static string Digest(string secret) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(secret)));
    public static string Normalize(string value) => value.Trim().ToUpperInvariant();

    public async Task<SessionIssue> Login(string identifier, string password, string audience, CancellationToken ct)
    {
        if (audience is not ("web" or "admin")) throw Error("validation_failed", 422, "พื้นที่เข้าสู่ระบบไม่ถูกต้อง");
        var account = await store.FindByUsername(Normalize(identifier), ct);
        var credential = account is null ? null : await store.FindCredential(account.Id, ct);
        // Always exercise the password hash path, including unknown usernames.
        var valid = false;
        if (account is not null && credential is not null) valid = passwords.Verify(account, credential.PasswordHash, password);
        else passwords.VerifyUnknown(password);
        if (account is null || credential is null || !valid)
            throw Error("credentials_invalid", 401, "ข้อมูลเข้าสู่ระบบไม่ถูกต้อง");
        if (account.Disabled) throw Error("account_disabled", 403, "บัญชีนี้ถูกระงับ");
        if (audience == "admin" && !account.HasRole("admin"))
            throw Error("audience_not_allowed", 403, "บัญชีนี้เข้าส่วนผู้ดูแลไม่ได้");
        var secret = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
        var expires = clock.GetUtcNow().AddHours(12);
        store.AddSession(new AppSession { TokenHash = Digest(secret), AccountId = account.Id, Audience = audience, ExpiresAt = expires });
        await store.Save(ct);
        return new SessionIssue(account, secret, expires);
    }

    public async Task<AppSession?> Authenticate(string? secret, string audience, CancellationToken ct)
    {
        if (string.IsNullOrEmpty(secret) || secret.Length != 64) return null;
        var session = await store.FindSession(Digest(secret), ct);
        return session is not null && session.Audience == audience && session.RevokedAt is null
            && session.ExpiresAt > clock.GetUtcNow() && !session.Account.Disabled
            && (audience != "admin" || session.Account.HasRole("admin")) ? session : null;
    }

    public async Task Logout(AppSession session, CancellationToken ct)
    {
        session.RevokedAt = clock.GetUtcNow();
        await store.Save(ct);
    }

    public async Task<Account> CreateLocalAccount(Account actor, string username, string password, string displayName, CancellationToken ct)
    {
        if (!actor.HasRole("admin") || actor.Disabled) throw Error("forbidden", 403, "เฉพาะ Admin เท่านั้น");
        if (!Regex.IsMatch(username, "^[A-Za-z0-9_.]{3,30}$") || password.Length is < 12 or > 1024 || string.IsNullOrWhiteSpace(displayName) || displayName.Length > 80)
            throw Error("validation_failed", 422, "ข้อมูลบัญชีไม่ถูกต้อง");
        var normalized = Normalize(username);
        if (await store.UsernameExists(normalized, Guid.Empty, ct)) throw Error("username_conflict", 409, "Username นี้ถูกใช้แล้ว");
        var account = new Account { Username = username, NormalizedUsername = normalized, DisplayName = displayName.Trim(),
            CreatedBy = actor.Id, CreatedAt = clock.GetUtcNow() };
        store.AddLocalAccount(account, new LocalCredential { AccountId = account.Id, PasswordHash = passwords.Hash(account, password) });
        await store.Save(ct);
        return account;
    }

    public async Task<Account> UpdateProfile(Account account, JsonElement patch, CancellationToken ct)
    {
        if (patch.ValueKind != JsonValueKind.Object) throw Error("validation_failed", 422, "ข้อมูลไม่ถูกต้อง");
        foreach (var field in patch.EnumerateObject())
        {
            switch (field.Name)
            {
                case "display_name":
                    account.DisplayName = Text(field.Value, 80, false)!.Trim();
                    break;
                case "username":
                    var username = Text(field.Value, 30, false)!;
                    if (!Regex.IsMatch(username, "^[A-Za-z0-9_.]{3,30}$")) throw Error("validation_failed", 422, "Username ไม่ถูกต้อง");
                    var normalized = Normalize(username);
                    if (await store.UsernameExists(normalized, account.Id, ct)) throw Error("username_conflict", 409, "Username นี้ถูกใช้แล้ว");
                    account.Username = username;
                    account.NormalizedUsername = normalized;
                    break;
                case "avatar_url":
                    var avatar = Text(field.Value, 2048, true);
                    if (avatar is not null && (!Uri.TryCreate(avatar, UriKind.Absolute, out var uri) || uri.Scheme != "https" || !string.IsNullOrEmpty(uri.UserInfo)))
                        throw Error("validation_failed", 422, "URL ภาพต้องเป็น HTTPS");
                    account.AvatarUrl = avatar;
                    break;
                case "profile":
                    account.ProfileJson = MergeProfile(account.ProfileJson, field.Value);
                    break;
                default: throw Error("validation_failed", 422, "ฟิลด์นี้แก้ไขไม่ได้");
            }
        }
        account.Revision++;
        await store.Save(ct);
        return account;
    }

    private static string MergeProfile(string original, JsonElement patch)
    {
        if (patch.ValueKind != JsonValueKind.Object) throw Error("validation_failed", 422, "Profile ไม่ถูกต้อง");
        var values = JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(original)!;
        string[] strings = ["bio", "firstName", "lastName", "firstNameEnglish", "lastNameEnglish", "certificateName", "birthDate", "phone", "school", "educationLevel"];
        foreach (var field in patch.EnumerateObject())
        {
            if (strings.Contains(field.Name))
            {
                _ = Text(field.Value, field.Name == "bio" ? 2000 : 200, true);
                if (field.Value.ValueKind == JsonValueKind.Null) values.Remove(field.Name);
                else values[field.Name] = field.Value.Clone();
            }
            else if (field.Name is "interests" or "learningGoals")
            {
                if (field.Value.ValueKind != JsonValueKind.Array || field.Value.GetArrayLength() > 30)
                    throw Error("validation_failed", 422, "รายการ Profile ไม่ถูกต้อง");
                foreach (var item in field.Value.EnumerateArray()) _ = Text(item, 200, false, allowEmpty: true);
                values[field.Name] = field.Value.Clone();
            }
            else throw Error("validation_failed", 422, "ฟิลด์ Profile ไม่ถูกต้อง");
        }
        return JsonSerializer.Serialize(values);
    }

    private static string? Text(JsonElement value, int max, bool nullable, bool allowEmpty = false)
    {
        if (nullable && value.ValueKind == JsonValueKind.Null) return null;
        if (value.ValueKind != JsonValueKind.String) throw Error("validation_failed", 422, "ต้องเป็นข้อความ");
        var text = value.GetString()!;
        if (text.Length > max || (!allowEmpty && !nullable && string.IsNullOrWhiteSpace(text))) throw Error("validation_failed", 422, "ความยาวข้อความไม่ถูกต้อง");
        return text;
    }

    private static AccountOperationException Error(string code, int status, string message) => new(code, status, message);
}
