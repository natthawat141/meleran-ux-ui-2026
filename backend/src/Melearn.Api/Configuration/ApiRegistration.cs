using System.Text.Json;
using System.Text.Json.Serialization;
using Melearn.Api.Contracts.Errors;
using Melearn.Api.Middleware;
using Microsoft.AspNetCore.Mvc;

namespace Melearn.Api.Configuration;

public static class ApiRegistration
{
    public static IServiceCollection AddApiFoundation(this IServiceCollection services)
    {
        services.AddControllers().AddJsonOptions(options =>
        {
            options.JsonSerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower;
            options.JsonSerializerOptions.UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow;
        });
        services.Configure<Microsoft.AspNetCore.Http.Json.JsonOptions>(options =>
        {
            options.SerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower;
            options.SerializerOptions.UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow;
        });
        services.Configure<ApiBehaviorOptions>(options =>
        {
            options.InvalidModelStateResponseFactory = action =>
            {
                var fields = action.ModelState
                    .Where(pair => pair.Value?.Errors.Count > 0)
                    .Select(pair => new ValidationField(string.Join('.', pair.Key.Split('.')
                        .Select(JsonNamingPolicy.SnakeCaseLower.ConvertName)), "invalid"))
                    .ToArray();
                return new UnprocessableEntityObjectResult(ApiErrorEnvelope.Create(
                    "validation_failed", "ข้อมูลที่ส่งไม่ถูกต้อง", action.HttpContext,
                    new ValidationDetails(fields)));
            };
        });
        services.AddExceptionHandler<ApiExceptionHandler>();
        services.AddProblemDetails();
        return services;
    }
}
