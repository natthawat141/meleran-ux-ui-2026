using System.Security.Claims;
using System.Text.Encodings.Web;
using Melearn.Application.Accounts;
using Melearn.Domain.Accounts;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Options;

namespace Melearn.Api.Configuration;

public sealed class SessionAuthentication(IOptionsMonitor<AuthenticationSchemeOptions> options, ILoggerFactory logger,
    UrlEncoder encoder, IServiceProvider services) : AuthenticationHandler<AuthenticationSchemeOptions>(options, logger, encoder)
{
    public const string SchemeName = "MelearnSession";
    public const string SessionItem = "Melearn.Session";
    public static string? Audience(HttpContext context)
    {
        var value = context.Request.Headers["x-melearn-app"].ToString();
        return value is "web" or "admin" ? value : null;
    }
    public static string Cookie(string audience) => $"melearn_{audience}_session";
    protected override async Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        var audience = Audience(Context);
        if (audience is null || !Request.Cookies.TryGetValue(Cookie(audience), out var secret)) return AuthenticateResult.NoResult();
        var session = await services.GetRequiredService<AccountService>().Authenticate(secret, audience, Context.RequestAborted);
        if (session is null) return AuthenticateResult.Fail("Invalid session");
        Context.Items[SessionItem] = session;
        var claims = new List<Claim> { new(ClaimTypes.NameIdentifier, session.AccountId.ToString()), new("audience", audience) };
        claims.AddRange(session.Account.Roles.Split(',').Select(role => new Claim(ClaimTypes.Role, role)));
        return AuthenticateResult.Success(new AuthenticationTicket(new ClaimsPrincipal(new ClaimsIdentity(claims, SchemeName)), SchemeName));
    }
}
