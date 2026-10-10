using Melearn.Application.Courses;
using Melearn.Domain.Courses;
using Melearn.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using System.Data;
using Melearn.Application.Accounts;

namespace Melearn.Infrastructure.Courses;

public sealed class EfCatalogStore(MelearnDbContext db) : ICatalogStore
{
    private IQueryable<Course> Published => db.Courses.AsNoTracking().Where(x => x.Status == "published" && x.PublishedAt != null).Include(x => x.Instructor);
    public async Task<IReadOnlyList<Course>> List(CatalogQuery query, CancellationToken ct)
    {
        var courses = Published;
        if (!string.IsNullOrWhiteSpace(query.Search)) courses = courses.Where(x => x.Title.Contains(query.Search));
        if (!string.IsNullOrEmpty(query.Category)) courses = courses.Where(x => x.Category == query.Category);
        if (!string.IsNullOrEmpty(query.Level)) courses = courses.Where(x => x.Level == query.Level);
        if (query.PriceType == "free") courses = courses.Where(x => x.PriceMinor == null || x.PriceMinor == 0);
        if (query.PriceType == "paid") courses = courses.Where(x => x.PriceMinor > 0);
        return await courses.OrderBy(x => x.Id).Skip(query.Offset).Take(query.Limit + 1).ToListAsync(ct);
    }
    public Task<Course?> Get(Guid id, CancellationToken ct) => Published.Include(x => x.Chapters).ThenInclude(x => x.Items).SingleOrDefaultAsync(x => x.Id == id, ct);
    public async Task<Enrollment> GrantFree(Guid accountId, Guid courseId, DateTimeOffset now, CancellationToken ct)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
        var course = await db.Courses.AsNoTracking().SingleOrDefaultAsync(x => x.Id == courseId, ct);
        var account = await db.Accounts.AsNoTracking().SingleAsync(x => x.Id == accountId, ct);
        if (course is null || course.Status != "published" || course.PublishedAt is null) throw new AccountOperationException("not_found", 404, "ไม่พบคอร์ส");
        if (account.Disabled || account.HasRole("admin") || course.InstructorId == accountId) throw new AccountOperationException("forbidden", 403, "บัญชีนี้ลงเรียนคอร์สนี้ไม่ได้");
        if (!account.LearningEligible) throw new AccountOperationException("email_not_verified", 403, "กรุณายืนยันอีเมลก่อนลงเรียน");
        if (course.PriceMinor is > 0) throw new AccountOperationException("paid_course_requires_checkout", 409, "คอร์สนี้ต้องชำระเงินหรือแลกโค้ด");
        var existing = await db.Enrollments.SingleOrDefaultAsync(x => x.AccountId == accountId && x.CourseId == courseId, ct);
        if (existing is not null) return existing;
        var enrollment = new Enrollment { AccountId = accountId, CourseId = courseId, GrantedAt = now };
        db.Enrollments.Add(enrollment);
        try { await db.SaveChangesAsync(ct); await transaction.CommitAsync(ct); }
        catch (DbUpdateException exception) when (exception.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
        {
            await transaction.RollbackAsync(ct);
            db.Entry(enrollment).State = EntityState.Detached;
            return await db.Enrollments.SingleAsync(x => x.AccountId == accountId && x.CourseId == courseId, ct);
        }
        catch (DbUpdateException exception) when (exception.InnerException is PostgresException { SqlState: PostgresErrorCodes.SerializationFailure })
        { throw new AccountOperationException("revision_conflict", 409, "ข้อมูลเปลี่ยนระหว่างลงเรียน กรุณาลองใหม่"); }
        catch (PostgresException exception) when (exception.SqlState == PostgresErrorCodes.SerializationFailure)
        { throw new AccountOperationException("revision_conflict", 409, "ข้อมูลเปลี่ยนระหว่างลงเรียน กรุณาลองใหม่"); }
        return enrollment;
    }
    public async Task<IReadOnlyList<Enrollment>> Enrollments(Guid accountId, int limit, int offset, CancellationToken ct)
        => await db.Enrollments.AsNoTracking().Where(x => x.AccountId == accountId).Include(x => x.Course).ThenInclude(x => x.Instructor)
            .Include(x => x.Course).ThenInclude(x => x.Chapters).ThenInclude(x => x.Items)
            .OrderBy(x => x.Id).Skip(offset).Take(limit + 1).ToListAsync(ct);
}
