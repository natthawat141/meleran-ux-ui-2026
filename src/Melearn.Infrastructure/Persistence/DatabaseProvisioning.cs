using System.Data;
using System.Text.RegularExpressions;
using Melearn.Application.Accounts;
using Melearn.Domain.Accounts;
using Microsoft.EntityFrameworkCore;

namespace Melearn.Infrastructure.Persistence;

// Operator-only command. Never exposed through HTTP or run on application startup.
public sealed class DatabaseProvisioning(MelearnDbContext db, ILocalPassword passwords)
{
    public async Task<Guid> BootstrapAdmin(string username, string password, string displayName, CancellationToken ct)
    {
        if (!Regex.IsMatch(username, "^[A-Za-z0-9_.]{3,30}$") || password.Length is < 12 or > 1024 || string.IsNullOrWhiteSpace(displayName) || displayName.Length > 80)
            throw new InvalidOperationException("Bootstrap configuration invalid: username 3–30 ASCII characters; password 12–1024; display name 1–80.");
        await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
        if (await db.Accounts.AnyAsync(ct)) throw new InvalidOperationException("Bootstrap refused: accounts already exist. Use normal Admin management.");
        var account = new Account { Username = username, NormalizedUsername = AccountService.Normalize(username), DisplayName = displayName.Trim(), Roles = "admin" };
        db.Accounts.Add(account);
        db.LocalCredentials.Add(new LocalCredential { AccountId = account.Id, PasswordHash = passwords.Hash(account, password) });
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        return account.Id;
    }
}
