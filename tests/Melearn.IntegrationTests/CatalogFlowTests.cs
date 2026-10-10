using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Melearn.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Melearn.IntegrationTests;

public sealed class CatalogFlowTests
{
    [Fact]
    public async Task Empty_database_can_be_bootstrapped_once_and_initial_admin_can_login()
    {
        using var factory = new AccountFactory();
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<MelearnDbContext>(); await db.Database.EnsureCreatedAsync();
            var provisioning = scope.ServiceProvider.GetRequiredService<DatabaseProvisioning>();
            _ = await provisioning.BootstrapAdmin("initialadmin", "test-password-123", "Initial Admin", CancellationToken.None);
            await Assert.ThrowsAsync<InvalidOperationException>(() => provisioning.BootstrapAdmin("secondadmin", "test-password-123", "Second", CancellationToken.None));
            Assert.Equal(1, await db.Accounts.CountAsync());
        }
        using var client = AccountFlowTests.Client(factory, "admin"); _ = await AccountFlowTests.Login(client, "initialadmin", "admin");
    }

    [Fact]
    public async Task Expired_session_is_rejected()
    {
        using var factory = new AccountFactory(); await factory.Initialize(); using var client = AccountFlowTests.Client(factory, "web");
        client.DefaultRequestHeaders.Add("Cookie", await AccountFlowTests.Login(client, "learner", "web"));
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<MelearnDbContext>(); var session = await db.Sessions.SingleAsync(); session.ExpiresAt = DateTimeOffset.UtcNow.AddMinutes(-1); await db.SaveChangesAsync();
        }
        using var response = await client.GetAsync("/api/v1/me"); Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }
    [Fact]
    public async Task Bootstrap_refuses_to_add_an_admin_to_an_existing_database()
    {
        using var factory = new AccountFactory(); await factory.Initialize(); using var scope = factory.Services.CreateScope();
        var provisioning = scope.ServiceProvider.GetRequiredService<DatabaseProvisioning>();
        await Assert.ThrowsAsync<InvalidOperationException>(() => provisioning.BootstrapAdmin("newadmin", "test-password-123", "Admin", CancellationToken.None));
        Assert.Equal(3, await scope.ServiceProvider.GetRequiredService<MelearnDbContext>().Accounts.CountAsync());
    }

    [Fact]
    public async Task Concurrent_profile_updates_are_rejected_instead_of_overwriting()
    {
        using var factory = new AccountFactory(); await factory.Initialize();
        using var first = factory.Services.CreateScope(); using var second = factory.Services.CreateScope();
        var firstDb = first.ServiceProvider.GetRequiredService<MelearnDbContext>(); var secondDb = second.ServiceProvider.GetRequiredService<MelearnDbContext>();
        var a = await firstDb.Accounts.SingleAsync(x => x.Username == "learner"); var b = await secondDb.Accounts.SingleAsync(x => x.Username == "learner");
        using var patch = JsonDocument.Parse("{\"display_name\":\"First writer\"}");
        await first.ServiceProvider.GetRequiredService<Melearn.Application.Accounts.AccountService>().UpdateProfile(a, patch.RootElement, CancellationToken.None);
        var conflict = await Assert.ThrowsAsync<Melearn.Application.Accounts.AccountOperationException>(() => second.ServiceProvider.GetRequiredService<Melearn.Application.Accounts.AccountService>().UpdateProfile(b, patch.RootElement, CancellationToken.None));
        Assert.Equal(409, conflict.Status);
    }
    [Fact]
    public async Task Catalog_excludes_drafts_supports_filters_pagination_and_safe_outline()
    {
        using var factory = new AccountFactory(); await factory.Initialize(); var ids = await factory.SeedCourses();
        using var client = AccountFlowTests.Client(factory, "web");
        var catalog = await client.GetFromJsonAsync<JsonElement>("/api/v1/courses?limit=1");
        Assert.Single(catalog.GetProperty("items").EnumerateArray());
        var next = catalog.GetProperty("next_cursor").GetString(); Assert.NotNull(next);
        var second = await client.GetFromJsonAsync<JsonElement>("/api/v1/courses?limit=1&cursor=" + Uri.EscapeDataString(next));
        Assert.Single(second.GetProperty("items").EnumerateArray());
        Assert.NotEqual(catalog.GetProperty("items")[0].GetProperty("id").GetString(), second.GetProperty("items")[0].GetProperty("id").GetString());
        var filtered = await client.GetFromJsonAsync<JsonElement>("/api/v1/courses?price_type=free&category=math&q=Free");
        Assert.Single(filtered.GetProperty("items").EnumerateArray());
        Assert.Equal(JsonValueKind.Null, filtered.GetProperty("items")[0].GetProperty("price").ValueKind);
        using var draft = await client.GetAsync($"/api/v1/courses/{ids[2]}"); Assert.Equal(HttpStatusCode.NotFound, draft.StatusCode);
        var detail = await client.GetFromJsonAsync<JsonElement>($"/api/v1/courses/{ids[0]}");
        Assert.Equal("article", detail.GetProperty("outline")[0].GetProperty("items")[0].GetProperty("type").GetString());
        Assert.False(detail.TryGetProperty("instructor_id", out _));
        using var invalid = await client.GetAsync("/api/v1/courses?limit=51"); Assert.Equal(HttpStatusCode.UnprocessableEntity, invalid.StatusCode);
    }

    [Fact]
    public async Task Free_enrollment_is_durable_idempotent_and_scoped_to_owner()
    {
        using var factory = new AccountFactory(); await factory.Initialize(); var ids = await factory.SeedCourses();
        using var client = AccountFlowTests.Client(factory, "web");
        client.DefaultRequestHeaders.Add("Cookie", await AccountFlowTests.Login(client, "learner", "web"));
        using var enrollment = await client.PostAsJsonAsync($"/api/v1/courses/{ids[0]}/enroll", new { });
        Assert.Equal(HttpStatusCode.OK, enrollment.StatusCode);
        var first = await enrollment.Content.ReadFromJsonAsync<JsonElement>(); Assert.Equal("lifetime", first.GetProperty("access").GetString());
        using var again = await client.PostAsync($"/api/v1/courses/{ids[0]}/enroll", null);
        Assert.Equal(HttpStatusCode.OK, again.StatusCode);
        Assert.Equal(first.GetProperty("id").GetString(), (await again.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetString());
        var own = await client.GetFromJsonAsync<JsonElement>("/api/v1/me/enrollments");
        Assert.Single(own.GetProperty("items").EnumerateArray()); Assert.Equal(1, own.GetProperty("items")[0].GetProperty("progress").GetProperty("total_items").GetInt32());
        using var other = AccountFlowTests.Client(factory, "admin"); other.DefaultRequestHeaders.Add("Cookie", await AccountFlowTests.Login(other, "admin", "admin"));
        var others = await other.GetFromJsonAsync<JsonElement>("/api/v1/me/enrollments"); Assert.Empty(others.GetProperty("items").EnumerateArray());
        using var scope = factory.Services.CreateScope(); Assert.Equal(1, await scope.ServiceProvider.GetRequiredService<MelearnDbContext>().Enrollments.CountAsync());
    }

    [Fact]
    public async Task Enrollment_rejects_admin_unverified_owner_paid_and_unpublished_courses()
    {
        using var factory = new AccountFactory(); await factory.Initialize(); var ids = await factory.SeedCourses();
        using var client = AccountFlowTests.Client(factory, "web"); client.DefaultRequestHeaders.Add("Cookie", await AccountFlowTests.Login(client, "learner", "web"));
        using var paid = await client.PostAsync($"/api/v1/courses/{ids[1]}/enroll", null); Assert.Equal(HttpStatusCode.Conflict, paid.StatusCode);
        using var draft = await client.PostAsync($"/api/v1/courses/{ids[2]}/enroll", null); Assert.Equal(HttpStatusCode.NotFound, draft.StatusCode);
        using var admin = AccountFlowTests.Client(factory, "admin"); admin.DefaultRequestHeaders.Add("Cookie", await AccountFlowTests.Login(admin, "admin", "admin"));
        using var deniedAdmin = await admin.PostAsync($"/api/v1/courses/{ids[0]}/enroll", null); Assert.Equal(HttpStatusCode.Forbidden, deniedAdmin.StatusCode);
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<MelearnDbContext>(); var learner = await db.Accounts.SingleAsync(x => x.Username == "learner");
            learner.Origin = "self_email"; learner.EmailVerified = false; await db.SaveChangesAsync();
        }
        using var unverified = await client.PostAsync($"/api/v1/courses/{ids[0]}/enroll", null); Assert.Equal(HttpStatusCode.Forbidden, unverified.StatusCode);
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<MelearnDbContext>(); var learner = await db.Accounts.SingleAsync(x => x.Username == "learner"); learner.EmailVerified = true;
            var course = await db.Courses.FindAsync(ids[0]); course!.InstructorId = learner.Id; await db.SaveChangesAsync();
        }
        using var own = await client.PostAsync($"/api/v1/courses/{ids[0]}/enroll", null); Assert.Equal(HttpStatusCode.Forbidden, own.StatusCode);
    }

    [Fact]
    public async Task Only_admin_session_can_create_local_learner_and_password_is_not_returned()
    {
        using var factory = new AccountFactory(); await factory.Initialize();
        using var admin = AccountFlowTests.Client(factory, "admin"); admin.DefaultRequestHeaders.Add("Cookie", await AccountFlowTests.Login(admin, "admin", "admin"));
        using var created = await admin.PostAsJsonAsync("/api/v1/admin/users", new { username = "new.learner", password = "test-password-123", display_name = "ผู้เรียนใหม่" });
        Assert.Equal(HttpStatusCode.Created, created.StatusCode); var body = await created.Content.ReadAsStringAsync(); Assert.DoesNotContain("test-password-123", body);
        var user = JsonDocument.Parse(body).RootElement.GetProperty("user"); Assert.True(user.GetProperty("learning_eligible").GetBoolean()); Assert.Equal("learner", user.GetProperty("roles")[0].GetString());
        using var newUser = AccountFlowTests.Client(factory, "web"); _ = await AccountFlowTests.Login(newUser, "new.learner", "web");
        using var duplicate = await admin.PostAsJsonAsync("/api/v1/admin/users", new { username = "NEW.LEARNER", password = "test-password-123", display_name = "Duplicate" }); Assert.Equal(HttpStatusCode.Conflict, duplicate.StatusCode);
        using var adminWeb = AccountFlowTests.Client(factory, "web"); adminWeb.DefaultRequestHeaders.Add("Cookie", await AccountFlowTests.Login(adminWeb, "admin", "web"));
        using var wrongApp = await adminWeb.PostAsJsonAsync("/api/v1/admin/users", new { username = "someone", password = "test-password-123", display_name = "Someone" }); Assert.Equal(HttpStatusCode.Forbidden, wrongApp.StatusCode);
    }
}
