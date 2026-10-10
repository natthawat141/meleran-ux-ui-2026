using Melearn.Api.Contracts.Errors;
using Microsoft.AspNetCore.Diagnostics;

namespace Melearn.Api.Middleware;

public sealed class ApiExceptionHandler(ILogger<ApiExceptionHandler> logger) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(
        HttpContext context, Exception exception, CancellationToken cancellationToken)
    {
        logger.LogError(exception, "Unhandled API error. RequestId: {RequestId}", context.TraceIdentifier);
        context.Response.StatusCode = StatusCodes.Status500InternalServerError;
        await context.Response.WriteAsJsonAsync(
            ApiErrorEnvelope.Create("internal_error", "ระบบขัดข้อง กรุณาลองใหม่", context),
            cancellationToken);
        return true;
    }
}
