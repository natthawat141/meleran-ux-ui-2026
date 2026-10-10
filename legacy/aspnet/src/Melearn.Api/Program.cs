using Melearn.Api.Configuration;
using Melearn.Api.Middleware;
using Melearn.Infrastructure;
using Microsoft.AspNetCore.Authentication;
using System.Threading.RateLimiting;
using Melearn.Api.Contracts.Errors;
using Melearn.Infrastructure.Persistence;

var builder = WebApplication.CreateBuilder(args.Where(arg => arg != "--bootstrap-admin").ToArray());
builder.Services.AddApiFoundation();
builder.Services.AddPersistence(builder.Configuration);
builder.Services.AddAuthentication(SessionAuthentication.SchemeName)
    .AddScheme<AuthenticationSchemeOptions, SessionAuthentication>(SessionAuthentication.SchemeName, _ => { });
builder.Services.AddAuthorization();
var origins = (builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? [])
    .Where(origin => !string.IsNullOrWhiteSpace(origin)).ToArray();
builder.Services.AddCors(options => options.AddDefaultPolicy(policy =>
{
    if (origins.Length > 0) policy.WithOrigins(origins).WithHeaders("content-type", "x-melearn-app", "accept").WithMethods("GET", "POST", "PATCH", "OPTIONS").AllowCredentials();
}));
builder.Services.AddRateLimiter(options =>
{
    options.AddPolicy("login", context => RateLimitPartition.GetFixedWindowLimiter(
        context.Connection.RemoteIpAddress?.ToString() ?? "unknown", _ => new FixedWindowRateLimiterOptions
        { PermitLimit = 10, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 }));
    options.OnRejected = async (context, ct) =>
    {
        context.HttpContext.Response.StatusCode = 429;
        context.HttpContext.Response.Headers.RetryAfter = "60";
        await context.HttpContext.Response.WriteAsJsonAsync(ApiErrorEnvelope.Create("rate_limited", "กรุณารอก่อนลองใหม่", context.HttpContext), ct);
    };
});

var app = builder.Build();
if (args.Contains("--bootstrap-admin", StringComparer.Ordinal))
{
    using var scope = app.Services.CreateScope();
    var provisioning = scope.ServiceProvider.GetRequiredService<DatabaseProvisioning>();
    var id = await provisioning.BootstrapAdmin(builder.Configuration["Bootstrap:AdminUsername"] ?? "",
        builder.Configuration["Bootstrap:AdminPassword"] ?? "", builder.Configuration["Bootstrap:AdminDisplayName"] ?? "", CancellationToken.None);
    Console.WriteLine($"Initial Admin created: {id}. No HTTP listener started.");
    return;
}
app.UseExceptionHandler();
app.UseApiStatusCodeResponses();
app.Use(async (context, next) =>
{
    if (context.Request.Path.StartsWithSegments("/api/v1")) context.Response.Headers.CacheControl = "no-store";
    await next(context);
});
app.UseCors();
app.UseSessionRequestProtection(origins);
app.UseAuthentication();
app.UseAuthorization();
app.UseRateLimiter();
app.MapControllers();
app.Run();

// Entry point for integration tests; contains no business logic.
public partial class Program { }
