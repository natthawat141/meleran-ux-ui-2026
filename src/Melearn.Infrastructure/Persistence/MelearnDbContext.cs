using Melearn.Domain.Accounts;
using Melearn.Domain.Courses;
using Microsoft.EntityFrameworkCore;

namespace Melearn.Infrastructure.Persistence;

public sealed class MelearnDbContext(DbContextOptions<MelearnDbContext> options) : DbContext(options)
{
    public DbSet<Account> Accounts => Set<Account>();
    public DbSet<LocalCredential> LocalCredentials => Set<LocalCredential>();
    public DbSet<ExternalIdentity> ExternalIdentities => Set<ExternalIdentity>();
    public DbSet<AppSession> Sessions => Set<AppSession>();
    public DbSet<Course> Courses => Set<Course>();
    public DbSet<Enrollment> Enrollments => Set<Enrollment>();

    protected override void OnModelCreating(ModelBuilder model)
    {
        var account = model.Entity<Account>();
        account.ToTable("accounts");
        account.HasKey(x => x.Id);
        account.Property(x => x.DisplayName).HasMaxLength(80);
        account.Property(x => x.Username).HasMaxLength(30);
        account.Property(x => x.NormalizedUsername).HasMaxLength(30);
        account.Property(x => x.Email).HasMaxLength(320);
        account.Property(x => x.NormalizedEmail).HasMaxLength(320);
        account.Property(x => x.AvatarUrl).HasMaxLength(2048);
        account.Property(x => x.Origin).HasMaxLength(20);
        account.Property(x => x.Roles).HasMaxLength(80);
        account.Property(x => x.Revision).IsConcurrencyToken();
        account.HasIndex(x => x.NormalizedUsername).IsUnique();
        account.HasIndex(x => x.NormalizedEmail).IsUnique();
        account.Ignore(x => x.LearningEligible);

        var credential = model.Entity<LocalCredential>();
        credential.ToTable("local_credentials");
        credential.HasKey(x => x.AccountId);
        credential.HasOne(x => x.Account).WithOne().HasForeignKey<LocalCredential>(x => x.AccountId).OnDelete(DeleteBehavior.Cascade);

        var identity = model.Entity<ExternalIdentity>();
        identity.ToTable("external_identities");
        identity.HasKey(x => x.Id);
        identity.Property(x => x.Project).HasMaxLength(128);
        identity.Property(x => x.Subject).HasMaxLength(128);
        identity.Property(x => x.Provider).HasMaxLength(32);
        identity.Property(x => x.Method).HasMaxLength(32);
        identity.HasIndex(x => new { x.Provider, x.Project, x.Subject }).IsUnique();
        identity.HasOne(x => x.Account).WithMany().HasForeignKey(x => x.AccountId).OnDelete(DeleteBehavior.Cascade);

        var session = model.Entity<AppSession>();
        session.ToTable("app_sessions");
        session.HasKey(x => x.TokenHash);
        session.Property(x => x.TokenHash).HasMaxLength(64);
        session.Property(x => x.Audience).HasMaxLength(5);
        session.HasIndex(x => new { x.AccountId, x.Audience });
        session.HasOne(x => x.Account).WithMany().HasForeignKey(x => x.AccountId).OnDelete(DeleteBehavior.Cascade);

        var course = model.Entity<Course>();
        course.ToTable("courses", table => table.HasCheckConstraint("ck_course_price", "\"PriceMinor\" IS NULL OR \"PriceMinor\" >= 0"));
        course.HasKey(x => x.Id);
        course.HasIndex(x => x.Slug).IsUnique();
        course.Property(x => x.Slug).HasMaxLength(200);
        course.Property(x => x.Title).HasMaxLength(200);
        course.Property(x => x.Status).HasMaxLength(32);
        course.HasOne(x => x.Instructor).WithMany().HasForeignKey(x => x.InstructorId).OnDelete(DeleteBehavior.Restrict);
        course.HasMany(x => x.Chapters).WithOne().HasForeignKey(x => x.CourseId).OnDelete(DeleteBehavior.Cascade);
        var chapter = model.Entity<CourseChapter>();
        chapter.ToTable("course_chapters");
        chapter.HasKey(x => x.Id);
        chapter.HasIndex(x => new { x.CourseId, x.Position }).IsUnique();
        chapter.HasMany(x => x.Items).WithOne().HasForeignKey(x => x.ChapterId).OnDelete(DeleteBehavior.Cascade);
        var item = model.Entity<CourseItem>();
        item.ToTable("course_items", table => table.HasCheckConstraint("ck_item_type", "\"Type\" IN ('article','video','quiz')"));
        item.HasKey(x => x.Id);
        item.HasIndex(x => new { x.ChapterId, x.Position }).IsUnique();
        var enrollment = model.Entity<Enrollment>();
        enrollment.ToTable("enrollments");
        enrollment.HasKey(x => x.Id);
        enrollment.HasIndex(x => new { x.AccountId, x.CourseId }).IsUnique();
        enrollment.HasOne<Account>().WithMany().HasForeignKey(x => x.AccountId).OnDelete(DeleteBehavior.Restrict);
        enrollment.HasOne(x => x.Course).WithMany().HasForeignKey(x => x.CourseId).OnDelete(DeleteBehavior.Restrict);
    }
}
