using Melearn.Api.Contracts.Errors;
using Melearn.Application.Operations;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Melearn.Api.Features.Operations;

[ApiController]
[AllowAnonymous]
[Route("health")]
public sealed class HealthController : ControllerBase
{
    [HttpGet("live")]
    public IActionResult Live() => Ok(new { status = "alive", stage = "foundation" });

    [HttpGet("ready")]
    public IActionResult Ready()
    {
        var readiness = BackendReadiness.Foundation;
        return StatusCode(StatusCodes.Status503ServiceUnavailable, ApiErrorEnvelope.Create(
            "backend_not_ready", "Backend ยังไม่มีบริการธุรกิจพร้อมใช้งาน", HttpContext,
            new { ready = readiness.Ready, missing_capabilities = readiness.MissingCapabilities }));
    }
}
