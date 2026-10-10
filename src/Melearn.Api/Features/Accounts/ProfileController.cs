using System.Text.Json;
using Melearn.Api.Configuration;
using Melearn.Application.Accounts;
using Melearn.Domain.Accounts;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Melearn.Api.Features.Accounts;

[ApiController]
[Authorize]
[Route("api/v1/me")]
[RequestSizeLimit(32768)]
public sealed class ProfileController(AccountService accounts) : ControllerBase
{
    private Account Account => ((AppSession)HttpContext.Items[SessionAuthentication.SessionItem]!).Account;
    [HttpGet]
    public async Task<IActionResult> Get(CancellationToken ct) => Ok(CurrentUser.From(Account, await accounts.AuthMethods(Account, ct)));
    [HttpPatch]
    public async Task<IActionResult> Patch(JsonElement patch, CancellationToken ct)
    {
        var account = await accounts.UpdateProfile(Account, patch, ct);
        return Ok(CurrentUser.From(account, await accounts.AuthMethods(account, ct)));
    }
}
