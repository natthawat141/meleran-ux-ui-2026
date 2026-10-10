using Melearn.Domain.Accounts;

namespace Melearn.Domain.Courses;

public sealed class Course
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Slug { get; set; } = "";
    public string Title { get; set; } = "";
    public string? Subtitle { get; set; }
    public string? CoverUrl { get; set; }
    public string Category { get; set; } = "";
    public string Level { get; set; } = "";
    public int? PriceMinor { get; set; }
    public string Status { get; set; } = "draft";
    public DateTimeOffset? PublishedAt { get; set; }
    public string? Description { get; set; }
    public string OutcomesJson { get; set; } = "[]";
    public Guid InstructorId { get; set; }
    public Account Instructor { get; set; } = null!;
    public List<CourseChapter> Chapters { get; set; } = [];
}

public sealed class CourseChapter
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid CourseId { get; set; }
    public string Title { get; set; } = "";
    public int Position { get; set; }
    public List<CourseItem> Items { get; set; } = [];
}

public sealed class CourseItem
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid ChapterId { get; set; }
    public string Title { get; set; } = "";
    public string Type { get; set; } = "article";
    public int Position { get; set; }
}

public sealed class Enrollment
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid AccountId { get; set; }
    public Guid CourseId { get; set; }
    public string Source { get; set; } = "free";
    public DateTimeOffset GrantedAt { get; set; }
    public int CompletedItems { get; set; }
    public DateTimeOffset? CompletedAt { get; set; }
    public Course Course { get; set; } = null!;
}
