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
    public async Task<string[]> AuthMethods(Guid id, CancellationToken ct)
    {
        var methods = await db.ExternalIdentities.Where(x => x.AccountId == id && (x.Method == "password" || x.Method == "google"))
            .Select(x => x.Method).Distinct().ToListAsync(ct);
        if (await db.LocalCredentials.AnyAsync(x => x.AccountId == id, ct)) methods.Add("password");
        return new[] { "password", "google" }.Where(methods.Contains).ToArray();
    }
    public async Task<IReadOnlyList<Account>> List(AccountListQuery query, CancellationToken ct)
    {
        var accounts = db.Accounts.AsNoTracking();
        if (query.InstructorsOnly) accounts = accounts.Where(x => ("," + x.Roles + ",").Contains(",instructor,"));
        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var search = query.Search.ToUpperInvariant();
            accounts = accounts.Where(x => x.DisplayName.ToUpper().Contains(search)
                || (x.NormalizedUsername != null && x.NormalizedUsername.Contains(search))
                || (x.NormalizedEmail != null && x.NormalizedEmail.Contains(search)));
        }
        return await accounts.OrderBy(x => x.Id).Skip(query.Offset).Take(query.Limit + 1).ToListAsync(ct);
    }
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
