using Melearn.Application.Accounts;
using Melearn.Infrastructure.Accounts;
using Melearn.Infrastructure.Persistence;
using Melearn.Application.Courses;
using Melearn.Infrastructure.Courses;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace Melearn.Infrastructure;

public static class Registration
{
    public static IServiceCollection AddPersistence(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddDbContext<MelearnDbContext>(options =>
        {
            var connection = configuration.GetConnectionString("Melearn");
            if (string.IsNullOrWhiteSpace(connection)) throw new AccountOperationException("persistence_not_configured", 503, "ยังไม่ได้ตั้งค่าฐานข้อมูล");
            options.UseNpgsql(connection);
        });
        services.AddScoped<IAccountStore, EfAccountStore>();
        services.AddSingleton<ILocalPassword, LocalPassword>();
        services.AddSingleton(TimeProvider.System);
        services.AddScoped<AccountService>();
        services.AddScoped<ICatalogStore, EfCatalogStore>();
        services.AddScoped<CatalogService>();
        services.AddScoped<DatabaseProvisioning>();
        return services;
    }
}
