using System.ComponentModel.DataAnnotations;
using System.Globalization;
using System.Text.Json;
using Melearn.Api.Configuration;
using Melearn.Application.Accounts;
using Melearn.Domain.Accounts;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Melearn.Api.Features.Accounts;

public sealed class AccountPageQuery
{
    [Range(1, 50)] public int Limit { get; set; } = 20;
    public string? Cursor { get; set; }
    public int Offset()
    {
        if (Cursor is null) return 0;
        if (Cursor.StartsWith("o:", StringComparison.Ordinal)
            && int.TryParse(Cursor.AsSpan(2), NumberStyles.None, CultureInfo.InvariantCulture, out var offset)
            && offset >= 0 && offset <= int.MaxValue - Limit) return offset;
        throw new AccountOperationException("validation_failed", 422, "Cursor ไม่ถูกต้อง");
    }
    public string? Next(bool more) => more ? $"o:{(Offset() + Limit).ToString(CultureInfo.InvariantCulture)}" : null;
}

public sealed record AdminUserSummary(Guid Id, string DisplayName, string? Username, string? Email,
    bool EmailVerified, string? AvatarUrl, string[] Roles, string Origin, string Status, DateTimeOffset CreatedAt)
{
    // Contract R4A §4: pending is self-email verification, not suspension or approval.
    public static string StatusOf(Account account) => account.Origin == "self_email" && !account.EmailVerified ? "pending" : "active";
    public static AdminUserSummary From(Account account) => new(account.Id, account.DisplayName, account.Username,
        account.Email, account.EmailVerified, account.AvatarUrl, account.Roles.Split(','), account.Origin, StatusOf(account), account.CreatedAt);
}

[ApiController]
[Authorize(Roles = "admin")]
[Route("api/v1/admin")]
public sealed class AccountManagementController(AccountService accounts) : ControllerBase
{
    private Account Actor
    {
        get
        {
            var session = (AppSession)HttpContext.Items[SessionAuthentication.SessionItem]!;
            if (session.Audience != "admin") throw new AccountOperationException("audience_not_allowed", 403, "ต้องเข้าสู่ระบบฝั่ง Admin");
            return session.Account;
        }
    }

    private static Guid AccountId(string id) => Guid.TryParse(id, out var value) ? value
        : throw new AccountOperationException("not_found", 404, "ไม่พบบัญชีผู้ใช้");

    [HttpGet("users")]
    public async Task<IActionResult> Users([FromQuery] AccountPageQuery page, [FromQuery] string? q, CancellationToken ct)
    {
        var accountsPage = await accounts.ListAccounts(Actor, new AccountListQuery(q, false, page.Limit, page.Offset()), ct);
        return Ok(new { items = accountsPage.Take(page.Limit).Select(AdminUserSummary.From), next_cursor = page.Next(accountsPage.Count > page.Limit) });
    }

    [HttpGet("users/{id}")]
    public async Task<IActionResult> Detail(string id, CancellationToken ct)
    {
        var actor = Actor;
        var account = await accounts.GetAccount(actor, AccountId(id), ct);
        var summary = AdminUserSummary.From(account);
        return Ok(new { summary.Id, summary.DisplayName, summary.Username, summary.Email, summary.EmailVerified,
            summary.AvatarUrl, summary.Roles, summary.Origin, summary.Status, summary.CreatedAt,
            profile = JsonSerializer.Deserialize<JsonElement>(account.ProfileJson), auth_methods = await accounts.AuthMethods(account, ct) });
    }

    [HttpGet("instructors")]
    public async Task<IActionResult> Instructors([FromQuery] AccountPageQuery page, CancellationToken ct)
    {
        var accountsPage = await accounts.ListAccounts(Actor, new AccountListQuery(null, true, page.Limit, page.Offset()), ct);
        return Ok(new { items = accountsPage.Take(page.Limit).Select(x => new { x.Id, x.DisplayName, x.AvatarUrl }),
            next_cursor = page.Next(accountsPage.Count > page.Limit) });
    }

    [HttpPost("users/{id}/instructor")]
    public async Task<IActionResult> AssignInstructor(string id, CancellationToken ct)
    {
        var actor = Actor;
        if (Request.ContentLength is > 0 || Request.Headers.TransferEncoding.Count > 0)
        {
            JsonDocument body;
            try { body = await JsonDocument.ParseAsync(Request.Body, cancellationToken: ct); }
            catch (JsonException) { throw new AccountOperationException("validation_failed", 422, "ข้อมูลไม่ถูกต้อง"); }
            using (body)
                if (body.RootElement.ValueKind != JsonValueKind.Object || body.RootElement.EnumerateObject().Any())
                    throw new AccountOperationException("validation_failed", 422, "คำขอนี้รับเฉพาะ object ว่าง");
        }
        var account = await accounts.AssignInstructor(actor, AccountId(id), ct);
        return Ok(new { user = CurrentUser.From(account, await accounts.AuthMethods(account, ct)),
            added_by = account.InstructorAddedBy, added_at = account.InstructorAddedAt });
    }
}
