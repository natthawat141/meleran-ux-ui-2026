using Melearn.Application.Accounts;
using Melearn.Domain.Accounts;
using Melearn.Domain.Courses;

namespace Melearn.Application.Courses;

public sealed record CatalogQuery(string? Search, string? Category, string? Level, string? PriceType, int Limit, int Offset);
public interface ICatalogStore
{
    Task<IReadOnlyList<Course>> List(CatalogQuery query, CancellationToken ct);
    Task<Course?> Get(Guid id, CancellationToken ct);
    Task<Enrollment> GrantFree(Guid accountId, Guid courseId, DateTimeOffset now, CancellationToken ct);
    Task<IReadOnlyList<Enrollment>> Enrollments(Guid accountId, int limit, int offset, CancellationToken ct);
}

public sealed class CatalogService(ICatalogStore store, TimeProvider clock)
{
    public Task<IReadOnlyList<Course>> List(CatalogQuery query, CancellationToken ct) => store.List(query, ct);
    public async Task<Course> Get(Guid id, CancellationToken ct) => await store.Get(id, ct)
        ?? throw new AccountOperationException("not_found", 404, "ไม่พบคอร์ส");
    public async Task<Enrollment> Enroll(Account account, Guid id, CancellationToken ct)
    {
        if (account.Disabled || account.HasRole("admin")) throw new AccountOperationException("forbidden", 403, "บัญชีนี้ลงเรียนไม่ได้");
        if (!account.LearningEligible) throw new AccountOperationException("email_not_verified", 403, "กรุณายืนยันอีเมลก่อนลงเรียน");
        var course = await Get(id, ct);
        if (course.InstructorId == account.Id) throw new AccountOperationException("own_course_not_allowed", 403, "ลงเรียนคอร์สของตนเองไม่ได้");
        if (course.PriceMinor is > 0) throw new AccountOperationException("paid_course_requires_checkout", 409, "คอร์สนี้ต้องชำระเงินหรือแลกโค้ด");
        return await store.GrantFree(account.Id, course.Id, clock.GetUtcNow(), ct);
    }
    public Task<IReadOnlyList<Enrollment>> Enrollments(Guid accountId, int limit, int offset, CancellationToken ct) => store.Enrollments(accountId, limit, offset, ct);
}
