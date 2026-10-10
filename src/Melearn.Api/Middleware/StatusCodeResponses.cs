using Melearn.Api.Contracts.Errors;

namespace Melearn.Api.Middleware;

public static class StatusCodeResponses
{
    public static IApplicationBuilder UseApiStatusCodeResponses(this IApplicationBuilder app)
        => app.UseStatusCodePages(async status =>
        {
            var context = status.HttpContext;
            var (code, message) = context.Response.StatusCode switch
            {
                401 => ("authentication_required", "กรุณาเข้าสู่ระบบ"),
                403 => ("forbidden", "ไม่มีสิทธิ์ใช้งาน"),
                404 => ("not_found", "ไม่พบข้อมูลหรือเส้นทางนี้"),
                405 => ("method_not_allowed", "เส้นทางนี้ไม่รองรับ HTTP method ที่ส่งมา"),
                _ => ("http_error", "ไม่สามารถดำเนินการได้")
            };
            await context.Response.WriteAsJsonAsync(
                ApiErrorEnvelope.Create(code, message, context), context.RequestAborted);
        });
}
