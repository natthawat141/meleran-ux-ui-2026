using Melearn.Application.Accounts;
using Melearn.Domain.Accounts;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Options;

namespace Melearn.Infrastructure.Accounts;

public sealed class LocalPassword : ILocalPassword
{
    private readonly PasswordHasher<Account> hasher = new(Options.Create(new PasswordHasherOptions { IterationCount = 210_000 }));
    private readonly Lazy<string> dummy = new(() => new PasswordHasher<Account>(Options.Create(new PasswordHasherOptions { IterationCount = 210_000 })).HashPassword(new Account(), Guid.NewGuid().ToString()));
    public string Hash(Account account, string password) => hasher.HashPassword(account, password);
    public bool Verify(Account account, string hash, string password) => hasher.VerifyHashedPassword(account, hash, password) != PasswordVerificationResult.Failed;
    public void VerifyUnknown(string password) => _ = Verify(new Account(), dummy.Value, password);
}
