using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace Melearn.Infrastructure.Persistence;

public sealed class DesignTimeDbContextFactory : IDesignTimeDbContextFactory<MelearnDbContext>
{
    public MelearnDbContext CreateDbContext(string[] args)
    {
        // Migration generation never connects. Database update requires an explicit environment value.
        var connection = Environment.GetEnvironmentVariable("ConnectionStrings__Melearn")
            ?? "Host=127.0.0.1;Port=5433;Database=melearn;Username=melearn_app";
        return new MelearnDbContext(new DbContextOptionsBuilder<MelearnDbContext>().UseNpgsql(connection).Options);
    }
}
