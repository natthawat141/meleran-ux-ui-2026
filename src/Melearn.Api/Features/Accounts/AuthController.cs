using Melearn.Api.Configuration;
using Melearn.Application.Accounts;
using Melearn.Domain.Accounts;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace Melearn.Api.Features.Accounts;

[ApiController]
[Route("api/v1/auth")]
[RequestSizeLimit(32768)]
public sealed class AuthController(IServiceProvider services, IWebHostEnvironment environment) : ControllerBase
{
    [AllowAnonymous]
    [HttpPost("login")]
    [EnableRateLimiting("login")]
    public async Task<IActionResult> Login(LoginRequest request, CancellationToken ct)
    {
        if (SessionAuthentication.Audience(HttpContext) != request.Audience)
            throw new AccountOperationException("validation_failed", 422, "พื้นที่เข้าสู่ระบบไม่ตรงกับแอป");
        var issue = await services.GetRequiredService<AccountService>().Login(request.Identifier, request.Password, request.Audience, ct);
        Response.Cookies.Append(SessionAuthentication.Cookie(request.Audience), issue.Secret, CookieOptions(issue.ExpiresAt));
        return Ok(new { user = CurrentUser.From(issue.Account) });
    }

    [Authorize]
    [HttpPost("logout")]
    public async Task<IActionResult> Logout(CancellationToken ct)
    {
        var session = (AppSession)HttpContext.Items[SessionAuthentication.SessionItem]!;
        await services.GetRequiredService<AccountService>().Logout(session, ct);
        Response.Cookies.Delete(SessionAuthentication.Cookie(session.Audience), CookieOptions(null));
        return NoContent();
    }

    private CookieOptions CookieOptions(DateTimeOffset? expires) => new()
    {
        HttpOnly = true, Secure = !environment.IsDevelopment() && !environment.IsEnvironment("Testing"),
        SameSite = SameSiteMode.Strict, Path = "/api/v1", Expires = expires
    };
}
