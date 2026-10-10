using System.ComponentModel.DataAnnotations;
using System.Text;
using System.Text.Json;
using Melearn.Api.Configuration;
using Melearn.Application.Accounts;
using Melearn.Application.Courses;
using Melearn.Domain.Accounts;
using Melearn.Domain.Courses;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Melearn.Api.Features.Courses;

public sealed record Money(int AmountMinor, string Currency = "THB");
public sealed record InstructorSummary(Guid Id, string DisplayName, string? AvatarUrl);
public sealed record CourseSummary(Guid Id, string Slug, string Title, string? Subtitle, string? CoverUrl,
    string Category, string Level, Money? Price, InstructorSummary Instructor, DateTimeOffset PublishedAt)
{
    public static CourseSummary From(Course course) => new(course.Id, course.Slug, course.Title, course.Subtitle, course.CoverUrl,
        course.Category, course.Level, course.PriceMinor is > 0 ? new Money(course.PriceMinor.Value) : null,
        new InstructorSummary(course.InstructorId, course.Instructor.DisplayName, course.Instructor.AvatarUrl), course.PublishedAt!.Value);
}
public sealed record EnrollmentDto(Guid Id, Guid CourseId, string Source, string Access, DateTimeOffset GrantedAt)
{
    public static EnrollmentDto From(Enrollment e) => new(e.Id, e.CourseId, e.Source, "lifetime", e.GrantedAt);
}
public sealed class PageQuery
{
    [Range(1, 50)] public int Limit { get; set; } = 20;
    [StringLength(64)] public string? Cursor { get; set; }
    public int Offset()
    {
        if (Cursor is null) return 0;
        try { if (int.TryParse(Encoding.UTF8.GetString(Convert.FromBase64String(Cursor)), out var offset) && offset is >= 0 and <= 100000) return offset; }
        catch (FormatException) { }
        throw new AccountOperationException("validation_failed", 422, "Cursor ไม่ถูกต้อง");
    }
    public string? Next(bool more) => more ? Convert.ToBase64String(Encoding.UTF8.GetBytes((Offset() + Limit).ToString(System.Globalization.CultureInfo.InvariantCulture))) : null;
}
public sealed class CatalogFilters
{
    [StringLength(200)] public string? Q { get; set; }
    [StringLength(100)] public string? Category { get; set; }
    [StringLength(100)] public string? Level { get; set; }
    [FromQuery(Name = "price_type"), RegularExpression("^(free|paid)$")] public string? PriceType { get; set; }
}

[ApiController]
[Route("api/v1/courses")]
[RequestSizeLimit(32768)]
public sealed class CatalogController(CatalogService catalog) : ControllerBase
{
    [AllowAnonymous]
    [HttpGet]
    public async Task<IActionResult> List([FromQuery] PageQuery page, [FromQuery] CatalogFilters filters, CancellationToken ct)
    {
        var courses = await catalog.List(new CatalogQuery(filters.Q, filters.Category, filters.Level, filters.PriceType, page.Limit, page.Offset()), ct);
        return Ok(new { items = courses.Take(page.Limit).Select(CourseSummary.From), next_cursor = page.Next(courses.Count > page.Limit) });
    }
    [AllowAnonymous]
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Detail(Guid id, CancellationToken ct)
    {
        var course = await catalog.Get(id, ct);
        var summary = CourseSummary.From(course);
        return Ok(new { summary.Id, summary.Slug, summary.Title, summary.Subtitle, summary.CoverUrl, summary.Category, summary.Level,
            summary.Price, summary.Instructor, summary.PublishedAt, course.Description,
            outcomes = JsonSerializer.Deserialize<string[]>(course.OutcomesJson),
            outline = course.Chapters.OrderBy(c => c.Position).Select(c => new { c.Id, c.Title,
                items = c.Items.OrderBy(i => i.Position).Select(i => new { i.Id, i.Type, i.Title }) }) });
    }
    [Authorize]
    [HttpPost("{id:guid}/enroll")]
    public async Task<IActionResult> Enroll(Guid id, CancellationToken ct)
    {
        // The existing contract permits only no body or an empty object.
        if (Request.ContentLength is > 0 || Request.Headers.TransferEncoding.Count > 0)
        {
            JsonDocument body;
            try { body = await JsonDocument.ParseAsync(Request.Body, cancellationToken: ct); }
            catch (JsonException) { throw new AccountOperationException("validation_failed", 422, "ข้อมูลไม่ถูกต้อง"); }
            using (body)
                if (body.RootElement.ValueKind != JsonValueKind.Object || body.RootElement.EnumerateObject().Any())
                    throw new AccountOperationException("validation_failed", 422, "คำขอนี้ไม่รับข้อมูลเพิ่มเติม");
        }
        var session = (AppSession)HttpContext.Items[SessionAuthentication.SessionItem]!;
        return Ok(EnrollmentDto.From(await catalog.Enroll(session.Account, id, ct)));
    }
}

[ApiController]
[Authorize]
[Route("api/v1/me/enrollments")]
public sealed class EnrollmentsController(CatalogService catalog) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List([FromQuery] PageQuery page, CancellationToken ct)
    {
        var session = (AppSession)HttpContext.Items[SessionAuthentication.SessionItem]!;
        var items = await catalog.Enrollments(session.AccountId, page.Limit, page.Offset(), ct);
        return Ok(new { items = items.Take(page.Limit).Select(e => new { enrollment = EnrollmentDto.From(e), course = CourseSummary.From(e.Course),
            progress = new { completed_items = e.CompletedItems, total_items = e.Course.Chapters.Sum(c => c.Items.Count), completed_at = e.CompletedAt } }),
            next_cursor = page.Next(items.Count > page.Limit) });
    }
}
