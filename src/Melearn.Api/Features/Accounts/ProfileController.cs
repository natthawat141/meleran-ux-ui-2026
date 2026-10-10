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
    public IActionResult Get() => Ok(CurrentUser.From(Account));
    [HttpPatch]
    public async Task<IActionResult> Patch(JsonElement patch, CancellationToken ct) => Ok(CurrentUser.From(await accounts.UpdateProfile(Account, patch, ct)));
}
