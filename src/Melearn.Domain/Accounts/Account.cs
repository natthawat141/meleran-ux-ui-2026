namespace Melearn.Domain.Accounts;

public sealed class Account
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string DisplayName { get; set; } = "";
    public string? Username { get; set; }
    public string? NormalizedUsername { get; set; }
    public string? Email { get; set; }
    public string? NormalizedEmail { get; set; }
    public bool EmailVerified { get; set; }
    public string? AvatarUrl { get; set; }
    public string Origin { get; set; } = "admin_created";
    public string Roles { get; set; } = "learner";
    public bool Disabled { get; set; }
    public string ProfileJson { get; set; } = "{}";
    public int Revision { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public Guid? CreatedBy { get; set; }
    public Guid? InstructorAddedBy { get; set; }
    public DateTimeOffset? InstructorAddedAt { get; set; }
    public bool HasRole(string role) => Roles.Split(',').Contains(role, StringComparer.Ordinal);
    public bool LearningEligible => !Disabled && (Origin == "admin_created" || EmailVerified);
}

public sealed class LocalCredential
{
    public Guid AccountId { get; set; }
    public string PasswordHash { get; set; } = "";
    public Account Account { get; set; } = null!;
}

public sealed class ExternalIdentity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid AccountId { get; set; }
    public string Provider { get; set; } = "firebase";
    public string Project { get; set; } = "";
    public string Subject { get; set; } = "";
    public string Method { get; set; } = "password";
    public Account Account { get; set; } = null!;
}

public sealed class AppSession
{
    // Only a SHA-256 digest is persisted; the bearer secret exists only in the cookie.
    public string TokenHash { get; set; } = "";
    public Guid AccountId { get; set; }
    public string Audience { get; set; } = "";
    public DateTimeOffset ExpiresAt { get; set; }
    public DateTimeOffset? RevokedAt { get; set; }
    public Account Account { get; set; } = null!;
}
