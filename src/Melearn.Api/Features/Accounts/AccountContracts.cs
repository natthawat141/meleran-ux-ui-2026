using System.ComponentModel.DataAnnotations;
using System.Text.Json;
using Melearn.Domain.Accounts;

namespace Melearn.Api.Features.Accounts;

public sealed record LoginRequest([Required, StringLength(320, MinimumLength = 1)] string Identifier,
    [Required, StringLength(1024, MinimumLength = 1)] string Password,
    [Required, RegularExpression("^(web|admin)$")] string Audience);

public sealed record CurrentUser(Guid Id, string DisplayName, string? Username, string? Email, bool EmailVerified,
    string? AvatarUrl, string[] Roles, string Origin, string[] AuthMethods, bool LearningEligible, JsonElement Profile)
{
    public static CurrentUser From(Account account) => new(account.Id, account.DisplayName, account.Username, account.Email,
        account.EmailVerified, account.AvatarUrl, account.Roles.Split(','), account.Origin,
        account.Origin == "google" ? ["google"] : ["password"], account.LearningEligible,
        JsonSerializer.Deserialize<JsonElement>(account.ProfileJson));
}
