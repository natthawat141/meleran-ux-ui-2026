using Melearn.Domain.Accounts;

namespace Melearn.Application.Accounts;

public interface IAccountStore
{
    Task<Account?> FindByUsername(string normalizedUsername, CancellationToken cancellationToken);
    Task<Account?> FindById(Guid id, CancellationToken cancellationToken);
    Task<LocalCredential?> FindCredential(Guid id, CancellationToken cancellationToken);
    Task<AppSession?> FindSession(string digest, CancellationToken cancellationToken);
    Task<bool> UsernameExists(string normalizedUsername, Guid except, CancellationToken cancellationToken);
    void AddSession(AppSession session);
    void AddLocalAccount(Account account, LocalCredential credential);
    Task Save(CancellationToken cancellationToken);
}

public interface ILocalPassword
{
    string Hash(Account account, string password);
    bool Verify(Account account, string hash, string password);
    void VerifyUnknown(string password);
}

public sealed class AccountOperationException(string code, int status, string message) : Exception(message)
{
    public string Code { get; } = code;
    public int Status { get; } = status;
}
