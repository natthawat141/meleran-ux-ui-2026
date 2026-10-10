using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Melearn.Application.Accounts;
using Melearn.Domain.Accounts;
using Melearn.Domain.Courses;
using Melearn.Infrastructure.Accounts;
using Melearn.Infrastructure.Persistence;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace Melearn.IntegrationTests;

public sealed class AccountFactory : WebApplicationFactory<Program>
{
    private static readonly Lazy<string> TestPasswordHash = new(() => new LocalPassword().Hash(new Account(), "test-password-123"));
    private readonly SqliteConnection connection = new("Data Source=:memory:");
    public AccountFactory() => connection.Open();
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.ConfigureAppConfiguration((_, configuration) => configuration.AddInMemoryCollection(new Dictionary<string, string?>
        { ["Cors:AllowedOrigins:0"] = "https://web.example.test" }));
        builder.ConfigureServices(services =>
        {
            services.RemoveAll<DbContextOptions<MelearnDbContext>>();
            services.RemoveAll<MelearnDbContext>();
            services.RemoveAll<Microsoft.EntityFrameworkCore.Infrastructure.IDbContextOptionsConfiguration<MelearnDbContext>>();
            services.AddDbContext<MelearnDbContext>(options => options.UseSqlite(connection));
        });
    }
    public async Task Initialize()
    {
        using var scope = Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<MelearnDbContext>();
        await db.Database.EnsureCreatedAsync();
        foreach (var (username, roles, disabled) in new[] { ("learner", "learner", false), ("admin", "admin", false), ("disabled", "learner", true) })
        {
            var account = new Account { Username = username, NormalizedUsername = AccountService.Normalize(username), DisplayName = username, Roles = roles, Disabled = disabled };
            db.Accounts.Add(account);
            db.LocalCredentials.Add(new LocalCredential { AccountId = account.Id, PasswordHash = TestPasswordHash.Value });
        }
        await db.SaveChangesAsync();
    }
    public async Task<Guid[]> SeedCourses()
    {
        using var scope = Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<MelearnDbContext>();
        var instructor = new Account { DisplayName = "ผู้สอน", Roles = "instructor" };
        db.Accounts.Add(instructor);
        var courses = new[]
        {
            new Course { Title = "Free course", Slug = "free", Instructor = instructor, Category = "math", Level = "beginner", Status = "published", PublishedAt = DateTimeOffset.UtcNow,
                Chapters = [new CourseChapter { Title = "Chapter", Position = 0, Items = [new CourseItem { Title = "Article", Position = 0 }] }] },
            new Course { Title = "Paid course", Slug = "paid", Instructor = instructor, Status = "published", PublishedAt = DateTimeOffset.UtcNow, PriceMinor = 10000 },
            new Course { Title = "Draft secret", Slug = "draft", Instructor = instructor }
        };
        db.Courses.AddRange(courses); await db.SaveChangesAsync(); return courses.Select(x => x.Id).ToArray();
    }
    protected override void Dispose(bool disposing) { base.Dispose(disposing); if (disposing) connection.Dispose(); }
}

public sealed class AccountFlowTests
{
    internal static HttpClient Client(AccountFactory factory, string audience)
    {
        var client = factory.CreateClient(new WebApplicationFactoryClientOptions { HandleCookies = false });
        client.DefaultRequestHeaders.Add("x-melearn-app", audience);
        return client;
    }
    internal static async Task<string> Login(HttpClient client, string identifier, string audience)
    {
        using var response = await client.PostAsJsonAsync("/api/v1/auth/login", new { identifier, password = "test-password-123", audience });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var cookie = response.Headers.GetValues("Set-Cookie").Single();
        Assert.Contains("httponly", cookie, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("samesite=strict", cookie, StringComparison.OrdinalIgnoreCase);
        return cookie.Split(';')[0];
    }

    [Fact]
    public async Task Login_profile_patch_persisted_session_and_logout_work_over_http()
    {
        using var factory = new AccountFactory(); await factory.Initialize();
        using var client = Client(factory, "web");
        var cookie = await Login(client, "LEARNER", "web");
        client.DefaultRequestHeaders.Add("Cookie", cookie);
        using var me = await client.GetAsync("/api/v1/me");
        var user = await me.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(user.GetProperty("learning_eligible").GetBoolean());
        Assert.Equal(JsonValueKind.Null, user.GetProperty("email").ValueKind);
        using var changed = await client.PatchAsJsonAsync("/api/v1/me", new { display_name = "ชื่อใหม่", profile = new { firstName = "สมชาย", interests = new[] { "คณิตศาสตร์" } } });
        Assert.Equal(HttpStatusCode.OK, changed.StatusCode);
        using var anotherRequest = Client(factory, "web"); anotherRequest.DefaultRequestHeaders.Add("Cookie", cookie);
        var persisted = await anotherRequest.GetFromJsonAsync<JsonElement>("/api/v1/me");
        Assert.Equal("ชื่อใหม่", persisted.GetProperty("display_name").GetString());
        Assert.Equal("สมชาย", persisted.GetProperty("profile").GetProperty("firstName").GetString());
        using var logout = await client.PostAsync("/api/v1/auth/logout", null);
        Assert.Equal(HttpStatusCode.NoContent, logout.StatusCode);
        using var after = await anotherRequest.GetAsync("/api/v1/me");
        Assert.Equal(HttpStatusCode.Unauthorized, after.StatusCode);
        using var scope = factory.Services.CreateScope();
        var session = await scope.ServiceProvider.GetRequiredService<MelearnDbContext>().Sessions.SingleAsync();
        Assert.NotEqual(cookie.Split('=')[1], session.TokenHash);
        Assert.NotNull(session.RevokedAt);
    }

    [Fact]
    public async Task Web_and_admin_sessions_are_isolated_and_header_cannot_grant_admin()
    {
        using var factory = new AccountFactory(); await factory.Initialize();
        using var web = Client(factory, "web"); using var admin = Client(factory, "admin");
        var webCookie = await Login(web, "admin", "web"); var adminCookie = await Login(admin, "admin", "admin");
        web.DefaultRequestHeaders.Add("Cookie", webCookie + "; " + adminCookie);
        admin.DefaultRequestHeaders.Add("Cookie", adminCookie);
        using var logout = await web.PostAsync("/api/v1/auth/logout", null);
        Assert.Equal(HttpStatusCode.NoContent, logout.StatusCode);
        using var stillAdmin = await admin.GetAsync("/api/v1/me"); Assert.Equal(HttpStatusCode.OK, stillAdmin.StatusCode);
        using var learnerEscalation = await admin.PostAsJsonAsync("/api/v1/auth/login", new { identifier = "learner", password = "test-password-123", audience = "admin" });
        Assert.Equal(HttpStatusCode.Forbidden, learnerEscalation.StatusCode);
        using var stolenWeb = Client(factory, "admin"); stolenWeb.DefaultRequestHeaders.Add("Cookie", "melearn_admin_session=" + webCookie.Split('=')[1]);
        using var rejected = await stolenWeb.GetAsync("/api/v1/me"); Assert.Equal(HttpStatusCode.Unauthorized, rejected.StatusCode);
    }

    [Theory]
    [InlineData("learner", "wrong", 401)]
    [InlineData("unknown", "wrong", 401)]
    [InlineData("disabled", "test-password-123", 403)]
    public async Task Invalid_credentials_and_disabled_accounts_fail(string username, string password, int status)
    {
        using var factory = new AccountFactory(); await factory.Initialize(); using var client = Client(factory, "web");
        using var response = await client.PostAsJsonAsync("/api/v1/auth/login", new { identifier = username, password, audience = "web" });
        Assert.Equal(status, (int)response.StatusCode); Assert.False(response.Headers.Contains("Set-Cookie"));
    }

    [Theory]
    [InlineData("{\"roles\":[\"admin\"]}")]
    [InlineData("{\"email_verified\":true}")]
    [InlineData("{\"profile\":{\"unknown\":\"x\"}}")]
    [InlineData("{\"profile\":{\"interests\":null}}")]
    [InlineData("{\"display_name\":\" \"}")]
    [InlineData("{\"avatar_url\":\"javascript:alert(1)\"}")]
    public async Task Invalid_profile_fields_do_not_change_permissions(string json)
    {
        using var factory = new AccountFactory(); await factory.Initialize(); using var client = Client(factory, "web");
        client.DefaultRequestHeaders.Add("Cookie", await Login(client, "learner", "web"));
        using var response = await client.PatchAsync("/api/v1/me", new StringContent(json, System.Text.Encoding.UTF8, "application/json"));
        Assert.Equal(HttpStatusCode.UnprocessableEntity, response.StatusCode);
        var me = await client.GetFromJsonAsync<JsonElement>("/api/v1/me"); Assert.Equal("learner", me.GetProperty("roles")[0].GetString());
    }

    [Fact]
    public async Task Wrong_origin_and_missing_app_header_cannot_mutate_even_with_cookie()
    {
        using var factory = new AccountFactory(); await factory.Initialize(); using var client = Client(factory, "web");
        var cookie = await Login(client, "learner", "web"); client.DefaultRequestHeaders.Add("Cookie", cookie);
        client.DefaultRequestHeaders.Add("Origin", "https://evil.example.test");
        using var denied = await client.PatchAsJsonAsync("/api/v1/me", new { display_name = "stolen" }); Assert.Equal(HttpStatusCode.Forbidden, denied.StatusCode);
        client.DefaultRequestHeaders.Remove("Origin"); client.DefaultRequestHeaders.Remove("x-melearn-app");
        using var missing = await client.PostAsync("/api/v1/auth/logout", null); Assert.Equal(HttpStatusCode.Forbidden, missing.StatusCode);
    }
}
