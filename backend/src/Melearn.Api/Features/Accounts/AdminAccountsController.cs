using System.ComponentModel.DataAnnotations;
using Melearn.Api.Configuration;
using Melearn.Application.Accounts;
using Melearn.Domain.Accounts;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Melearn.Api.Features.Accounts;

public sealed record AdminCreateUserRequest([Required, RegularExpression("^[A-Za-z0-9_.]{3,30}$")] string Username,
    [Required, StringLength(1024, MinimumLength = 12)] string Password,
    [Required, StringLength(80, MinimumLength = 1)] string DisplayName, string? Email);

[ApiController]
[Authorize(Roles = "admin")]
[Route("api/v1/admin/users")]
[RequestSizeLimit(32768)]
public sealed class AdminAccountsController(AccountService accounts) : ControllerBase
{
    [HttpPost]
    public async Task<IActionResult> Create(AdminCreateUserRequest request, CancellationToken ct)
    {
        var session = (AppSession)HttpContext.Items[SessionAuthentication.SessionItem]!;
        if (session.Audience != "admin") throw new AccountOperationException("audience_not_allowed", 403, "ต้องเข้าสู่ระบบฝั่ง Admin");
        if (request.Email is not null) throw new AccountOperationException("email_verification_required", 422, "การผูกอีเมลต้องผ่าน flow ยืนยันอีเมล; สร้าง Username โดยไม่มีอีเมลก่อน");
        var account = await accounts.CreateLocalAccount(session.Account, request.Username, request.Password, request.DisplayName, ct);
        return StatusCode(201, new { user = CurrentUser.From(account, await accounts.AuthMethods(account, ct)), created_by = session.AccountId, created_at = account.CreatedAt });
    }
}
