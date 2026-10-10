using Melearn.Api.Configuration;
using Melearn.Api.Contracts.Errors;

namespace Melearn.Api.Middleware;

public static class SessionRequestProtection
{
    // All mutations require a non-simple header. Browsers must preflight cross-origin requests.
    // Origin validation is also enforced before executing any operation, including login/logout.
    public static IApplicationBuilder UseSessionRequestProtection(this IApplicationBuilder app, string[] origins)
        => app.Use(async (context, next) =>
        {
            if (context.Request.Path.StartsWithSegments("/api/v1") &&
                context.Request.Method is not ("GET" or "HEAD" or "OPTIONS"))
            {
                var origin = context.Request.Headers.Origin.ToString();
                if (SessionAuthentication.Audience(context) is null ||
                    (!string.IsNullOrEmpty(origin) && !origins.Contains(origin, StringComparer.Ordinal)))
                {
                    context.Response.StatusCode = 403;
                    await context.Response.WriteAsJsonAsync(ApiErrorEnvelope.Create("request_origin_not_allowed", "คำขอจากแอปนี้ไม่ได้รับอนุญาต", context));
                    return;
                }
            }
            await next(context);
        });
}
