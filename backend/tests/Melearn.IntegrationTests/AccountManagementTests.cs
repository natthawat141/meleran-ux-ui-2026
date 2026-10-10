using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Melearn.Domain.Accounts;
using Melearn.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Melearn.IntegrationTests;

public sealed class AccountManagementTests
{
    private static async Task<HttpClient> AdminClient(AccountFactory factory, string audience = "admin")
    {
        var client = AccountFlowTests.Client(factory, audience);
        client.DefaultRequestHeaders.Add("Cookie", await AccountFlowTests.Login(client, "admin", audience));
        return client;
    }

    private static async Task<Guid> Id(AccountFactory factory, string username)
    {
        using var scope = factory.Services.CreateScope();
        return await scope.ServiceProvider.GetRequiredService<MelearnDbContext>().Accounts
            .Where(x => x.Username == username).Select(x => x.Id).SingleAsync();
    }

    [Fact]
    public async Task Users_pagination_search_and_detail_match_canonical_without_credentials_leaking()
    {
        using var factory = new AccountFactory(); await factory.Initialize();
        using var client = await AdminClient(factory);
        var ids = new HashSet<string>();
        string? cursor = null;
        do
        {
            var uri = "/api/v1/admin/users?limit=1" + (cursor is null ? "" : $"&cursor={Uri.EscapeDataString(cursor)}");
            var page = await client.GetFromJsonAsync<JsonElement>(uri);
            AccountContractAssertions.Response("get /admin/users", page);
            Assert.True(ids.Add(page.GetProperty("items")[0].GetProperty("id").GetString()!));
            cursor = page.GetProperty("next_cursor").GetString();
        } while (cursor is not null);
        Assert.Equal(3, ids.Count);
        var matches = await client.GetFromJsonAsync<JsonElement>("/api/v1/admin/users?q=LEARN");
        Assert.Equal("learner", Assert.Single(matches.GetProperty("items").EnumerateArray()).GetProperty("username").GetString());
        var empty = await client.GetFromJsonAsync<JsonElement>("/api/v1/admin/users?q=not-existing");
        AccountContractAssertions.Response("get /admin/users", empty);
        Assert.Empty(empty.GetProperty("items").EnumerateArray());
        Assert.Equal(JsonValueKind.Null, empty.GetProperty("next_cursor").ValueKind);
        var detail = await client.GetFromJsonAsync<JsonElement>($"/api/v1/admin/users/{await Id(factory, "learner")}");
        AccountContractAssertions.Response("get /admin/users/{id}", detail);
        Assert.Equal("active", detail.GetProperty("status").GetString());
        Assert.Equal(new[] { "password" }, detail.GetProperty("auth_methods").EnumerateArray().Select(x => x.GetString()));
    }

    [Fact]
    public async Task Status_is_email_verification_projection_not_an_invented_suspension_lifecycle()
    {
        using var factory = new AccountFactory(); await factory.Initialize();
        var id = await Id(factory, "learner");
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<MelearnDbContext>();
            var account = await db.Accounts.FindAsync(id);
            account!.Origin = "self_email"; account.Email = "pending@example.test"; account.NormalizedEmail = "PENDING@EXAMPLE.TEST";
            await db.SaveChangesAsync();
        }
        using var client = await AdminClient(factory);
        var page = await client.GetFromJsonAsync<JsonElement>("/api/v1/admin/users?q=PENDING@EXAMPLE.TEST");
        Assert.Equal("pending", Assert.Single(page.GetProperty("items").EnumerateArray()).GetProperty("status").GetString());
        var disabled = await client.GetFromJsonAsync<JsonElement>($"/api/v1/admin/users/{await Id(factory, "disabled")}");
        AccountContractAssertions.Response("get /admin/users/{id}", disabled);
        Assert.Equal("active", disabled.GetProperty("status").GetString());
    }

    [Theory]
    [InlineData("limit=0")]
    [InlineData("limit=51")]
    [InlineData("cursor=invalid")]
    [InlineData("cursor=o:-1")]
    public async Task Invalid_pagination_is_rejected(string query)
    {
        using var factory = new AccountFactory(); await factory.Initialize(); using var client = await AdminClient(factory);
        using var response = await client.GetAsync($"/api/v1/admin/users?{query}");
        Assert.Equal(HttpStatusCode.UnprocessableEntity, response.StatusCode);
        AccountContractAssertions.Named("ErrorEnvelope", await response.Content.ReadFromJsonAsync<JsonElement>());
    }

    [Theory]
    [InlineData("/api/v1/admin/users")]
    [InlineData("/api/v1/admin/instructors")]
    [InlineData("/api/v1/admin/users/not-an-existing-id")]
    public async Task Read_operations_require_admin_role_and_admin_app_session(string path)
    {
        using var factory = new AccountFactory(); await factory.Initialize();
        using var anonymous = AccountFlowTests.Client(factory, "admin");
        using var noLogin = await anonymous.GetAsync(path); Assert.Equal(HttpStatusCode.Unauthorized, noLogin.StatusCode);
        using var learner = AccountFlowTests.Client(factory, "web");
        learner.DefaultRequestHeaders.Add("Cookie", await AccountFlowTests.Login(learner, "learner", "web"));
        using var noRole = await learner.GetAsync(path); Assert.Equal(HttpStatusCode.Forbidden, noRole.StatusCode);
        using var adminInWeb = await AdminClient(factory, "web");
        using var wrongApp = await adminInWeb.GetAsync(path); Assert.Equal(HttpStatusCode.Forbidden, wrongApp.StatusCode);
    }

    [Fact]
    public async Task Instructor_grant_preserves_learner_persists_audit_and_replay_returns_original_grant()
    {
        using var factory = new AccountFactory(); await factory.Initialize(); using var client = await AdminClient(factory);
        var empty = await client.GetFromJsonAsync<JsonElement>("/api/v1/admin/instructors");
        AccountContractAssertions.Response("get /admin/instructors", empty); Assert.Empty(empty.GetProperty("items").EnumerateArray());
        var id = await Id(factory, "learner");
        using var response = await client.PostAsJsonAsync($"/api/v1/admin/users/{id}/instructor", new { });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var grant = await response.Content.ReadFromJsonAsync<JsonElement>();
        AccountContractAssertions.Response("post /admin/users/{id}/instructor", grant);
        Assert.Equal(new[] { "learner", "instructor" }, grant.GetProperty("user").GetProperty("roles").EnumerateArray().Select(x => x.GetString()));
        Assert.Equal((await Id(factory, "admin")).ToString(), grant.GetProperty("added_by").GetString());
        using var replayResponse = await client.PostAsync($"/api/v1/admin/users/{id}/instructor", null);
        var replay = await replayResponse.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(HttpStatusCode.OK, replayResponse.StatusCode);
        Assert.Equal(grant.GetProperty("added_at").GetString(), replay.GetProperty("added_at").GetString());
        Assert.Equal(grant.GetProperty("added_by").GetString(), replay.GetProperty("added_by").GetString());
        var instructors = await client.GetFromJsonAsync<JsonElement>("/api/v1/admin/instructors");
        AccountContractAssertions.Response("get /admin/instructors", instructors);
        Assert.Equal(id.ToString(), Assert.Single(instructors.GetProperty("items").EnumerateArray()).GetProperty("id").GetString());
        using var scope = factory.Services.CreateScope();
        var stored = await scope.ServiceProvider.GetRequiredService<MelearnDbContext>().Accounts.FindAsync(id);
        Assert.NotNull(stored!.InstructorAddedAt); Assert.Equal(1, stored.Revision);
    }

    [Theory]
    [InlineData("{\"roles\":[\"admin\"]}")]
    [InlineData("null")]
    [InlineData("[]")]
    [InlineData("not-json")]
    public async Task Instructor_request_accepts_only_the_contract_empty_object(string json)
    {
        using var factory = new AccountFactory(); await factory.Initialize(); using var client = await AdminClient(factory);
        var id = await Id(factory, "learner");
        using var response = await client.PostAsync($"/api/v1/admin/users/{id}/instructor", new StringContent(json, Encoding.UTF8, "application/json"));
        Assert.Equal(HttpStatusCode.UnprocessableEntity, response.StatusCode);
        using var scope = factory.Services.CreateScope();
        var account = await scope.ServiceProvider.GetRequiredService<MelearnDbContext>().Accounts.FindAsync(id);
        Assert.False(account!.HasRole("instructor"));
    }

    [Fact]
    public async Task Grant_cannot_promote_admin_or_be_called_by_learner_and_missing_user_is_404()
    {
        using var factory = new AccountFactory(); await factory.Initialize(); using var admin = await AdminClient(factory);
        using var denied = await admin.PostAsync($"/api/v1/admin/users/{await Id(factory, "admin")}/instructor", null);
        Assert.Equal(HttpStatusCode.Conflict, denied.StatusCode);
        Assert.Equal("invalid_state", (await denied.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("error").GetProperty("code").GetString());
        using var missing = await admin.PostAsync($"/api/v1/admin/users/{Guid.NewGuid()}/instructor", null);
        Assert.Equal(HttpStatusCode.NotFound, missing.StatusCode);
        using var unknownId = await admin.GetAsync("/api/v1/admin/users/unknown-user-id"); Assert.Equal(HttpStatusCode.NotFound, unknownId.StatusCode);
        using var learner = AccountFlowTests.Client(factory, "web");
        learner.DefaultRequestHeaders.Add("Cookie", await AccountFlowTests.Login(learner, "learner", "web"));
        using var noRole = await learner.PostAsync($"/api/v1/admin/users/{await Id(factory, "learner")}/instructor", null);
        Assert.Equal(HttpStatusCode.Forbidden, noRole.StatusCode);
        using var adminInWeb = await AdminClient(factory, "web");
        using var wrongApp = await adminInWeb.PostAsync($"/api/v1/admin/users/{await Id(factory, "learner")}/instructor", null);
        Assert.Equal(HttpStatusCode.Forbidden, wrongApp.StatusCode);
    }

    [Fact]
    public async Task Auth_methods_come_from_credentials_and_linked_identities_not_account_origin()
    {
        using var factory = new AccountFactory(); await factory.Initialize();
        var id = await Id(factory, "learner");
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<MelearnDbContext>();
            (await db.Accounts.FindAsync(id))!.Origin = "google";
            await db.SaveChangesAsync();
        }
        using var learner = AccountFlowTests.Client(factory, "web");
        using var login = await learner.PostAsJsonAsync("/api/v1/auth/login", new { identifier = "learner", password = "test-password-123", audience = "web" });
        var loginJson = await login.Content.ReadFromJsonAsync<JsonElement>();
        AccountContractAssertions.Named("CurrentUser", loginJson.GetProperty("user"));
        Assert.Equal(new[] { "password" }, loginJson.GetProperty("user").GetProperty("auth_methods").EnumerateArray().Select(x => x.GetString()));
        learner.DefaultRequestHeaders.Add("Cookie", login.Headers.GetValues("Set-Cookie").Single().Split(';')[0]);
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<MelearnDbContext>();
            (await db.Accounts.FindAsync(id))!.Origin = "admin_created";
            db.ExternalIdentities.AddRange(new ExternalIdentity { AccountId = id, Project = "test", Subject = "google-1", Method = "google" },
                new ExternalIdentity { AccountId = id, Project = "test", Subject = "google-2", Method = "google" });
            await db.SaveChangesAsync();
        }
        var me = await learner.GetFromJsonAsync<JsonElement>("/api/v1/me");
        AccountContractAssertions.Named("CurrentUser", me);
        Assert.Equal(new[] { "password", "google" }, me.GetProperty("auth_methods").EnumerateArray().Select(x => x.GetString()));
        using var patched = await learner.PatchAsJsonAsync("/api/v1/me", new { display_name = "Linked learner" });
        Assert.Equal(new[] { "password", "google" }, (await patched.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("auth_methods").EnumerateArray().Select(x => x.GetString()));
        using var admin = await AdminClient(factory);
        var detail = await admin.GetFromJsonAsync<JsonElement>($"/api/v1/admin/users/{id}");
        AccountContractAssertions.Response("get /admin/users/{id}", detail);
        Assert.Equal(new[] { "password", "google" }, detail.GetProperty("auth_methods").EnumerateArray().Select(x => x.GetString()));
    }
}
