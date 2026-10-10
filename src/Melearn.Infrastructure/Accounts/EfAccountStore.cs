using Melearn.Application.Accounts;
using Melearn.Domain.Accounts;
using Melearn.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace Melearn.Infrastructure.Accounts;

public sealed class EfAccountStore(MelearnDbContext db) : IAccountStore
{
    public Task<Account?> FindByUsername(string normalizedUsername, CancellationToken ct) => db.Accounts.SingleOrDefaultAsync(x => x.NormalizedUsername == normalizedUsername, ct);
    public Task<Account?> FindById(Guid id, CancellationToken ct) => db.Accounts.SingleOrDefaultAsync(x => x.Id == id, ct);
    public Task<LocalCredential?> FindCredential(Guid id, CancellationToken ct) => db.LocalCredentials.SingleOrDefaultAsync(x => x.AccountId == id, ct);
    public Task<AppSession?> FindSession(string digest, CancellationToken ct) => db.Sessions.Include(x => x.Account).SingleOrDefaultAsync(x => x.TokenHash == digest, ct);
    public Task<bool> UsernameExists(string normalizedUsername, Guid except, CancellationToken ct) => db.Accounts.AnyAsync(x => x.NormalizedUsername == normalizedUsername && x.Id != except, ct);
    public void AddSession(AppSession session) => db.Sessions.Add(session);
    public void AddLocalAccount(Account account, LocalCredential credential) { db.Accounts.Add(account); db.LocalCredentials.Add(credential); }
    public async Task Save(CancellationToken ct)
    {
        try { await db.SaveChangesAsync(ct); }
        catch (DbUpdateConcurrencyException) { throw new AccountOperationException("revision_conflict", 409, "ข้อมูลถูกแก้ไข กรุณาโหลดใหม่"); }
        catch (DbUpdateException exception) when (exception.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
        {
            var postgres = (PostgresException)exception.InnerException!;
            var code = postgres.ConstraintName?.Contains("NormalizedUsername", StringComparison.Ordinal) == true ? "username_conflict" : "account_conflict";
            throw new AccountOperationException(code, 409, "ข้อมูลบัญชีนี้ถูกใช้แล้ว");
        }
    }
}
