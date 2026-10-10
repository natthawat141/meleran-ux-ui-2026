using System.ComponentModel.DataAnnotations;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;

namespace Melearn.IntegrationTests;

public sealed class ApiFactory : WebApplicationFactory<Program>
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.ConfigureServices(services => services.AddControllers()
            .AddApplicationPart(typeof(FoundationTestController).Assembly));
    }
}

// These routes are discovered only in the test host, never in the production API.
[ApiController]
[Route("test-only")]
public sealed class FoundationTestController : ControllerBase
{
    [HttpGet("throw")]
    public IActionResult Throw() => throw new InvalidOperationException("DO_NOT_EXPOSE_INTERNAL_DETAILS");

    [HttpPost("validate")]
    public IActionResult Validate(ValidationInput input) => Ok(input);

    [HttpGet("nullable")]
    public IActionResult NullableProjection() => Ok(new { avatar_url = (string?)null });
}

public sealed record ValidationInput([Required] string Name);

public sealed class ApiFoundationTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    [Fact]
    public async Task Liveness_does_not_claim_business_readiness()
    {
        using var client = factory.CreateClient();
        using var response = await client.GetAsync("/health/live");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var json = await ReadJson(response);
        Assert.Equal("alive", json.GetProperty("status").GetString());
        Assert.Equal("foundation", json.GetProperty("stage").GetString());
    }

    [Fact]
    public async Task Readiness_fails_until_real_capabilities_exist()
    {
        using var client = factory.CreateClient();
        using var response = await client.GetAsync("/health/ready");
        Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);
        var error = AssertError(await ReadJson(response), "backend_not_ready");
        Assert.False(error.GetProperty("details").GetProperty("ready").GetBoolean());
        Assert.Equal(3, error.GetProperty("details").GetProperty("missing_capabilities").GetArrayLength());
    }

    [Theory]
    [InlineData("/api/v1/me")]
    [InlineData("/api/v1/courses")]
    [InlineData("/unknown")]
    public async Task Missing_business_routes_do_not_return_fake_success(string path)
    {
        using var client = factory.CreateClient();
        using var response = await client.GetAsync(path);
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        AssertError(await ReadJson(response), "not_found");
    }

    [Fact]
    public async Task Wrong_method_preserves_http_status_and_allow_header()
    {
        using var client = factory.CreateClient();
        using var response = await client.PostAsync("/health/live", null);
        Assert.Equal(HttpStatusCode.MethodNotAllowed, response.StatusCode);
        Assert.Contains("GET", response.Content.Headers.Allow);
        AssertError(await ReadJson(response), "method_not_allowed");
    }

    [Fact]
    public async Task Exceptions_use_the_contract_envelope_without_exposing_details()
    {
        using var client = factory.CreateClient();
        using var response = await client.GetAsync("/test-only/throw");
        Assert.Equal(HttpStatusCode.InternalServerError, response.StatusCode);
        var body = await response.Content.ReadAsStringAsync();
        Assert.DoesNotContain("DO_NOT_EXPOSE_INTERNAL_DETAILS", body);
        Assert.DoesNotContain("stack", body, StringComparison.OrdinalIgnoreCase);
        AssertError(JsonDocument.Parse(body).RootElement, "internal_error");
    }

    [Fact]
    public async Task Invalid_input_returns_422_with_fields_in_the_contract_envelope()
    {
        using var client = factory.CreateClient();
        using var response = await client.PostAsJsonAsync("/test-only/validate", new { });
        Assert.Equal(HttpStatusCode.UnprocessableEntity, response.StatusCode);
        var error = AssertError(await ReadJson(response), "validation_failed");
        Assert.NotEmpty(error.GetProperty("details").GetProperty("fields").EnumerateArray());
        Assert.Equal("name", error.GetProperty("details").GetProperty("fields")[0].GetProperty("field").GetString());
    }

    [Fact]
    public async Task Unknown_request_fields_are_rejected()
    {
        using var client = factory.CreateClient();
        using var response = await client.PostAsJsonAsync("/test-only/validate", new { name = "test", role = "admin" });
        Assert.Equal(HttpStatusCode.UnprocessableEntity, response.StatusCode);
        AssertError(await ReadJson(response), "validation_failed");
    }

    [Fact]
    public async Task Nullable_response_fields_are_not_silently_omitted()
    {
        using var client = factory.CreateClient();
        using var response = await client.GetAsync("/test-only/nullable");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var json = await ReadJson(response);
        Assert.Equal(JsonValueKind.Null, json.GetProperty("avatar_url").ValueKind);
    }

    private static async Task<JsonElement> ReadJson(HttpResponseMessage response)
    {
        Assert.Equal("application/json", response.Content.Headers.ContentType?.MediaType);
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        return json.RootElement.Clone();
    }

    private static JsonElement AssertError(JsonElement json, string code)
    {
        var error = json.GetProperty("error");
        Assert.Equal(code, error.GetProperty("code").GetString());
        Assert.False(string.IsNullOrWhiteSpace(error.GetProperty("message").GetString()));
        Assert.False(string.IsNullOrWhiteSpace(error.GetProperty("request_id").GetString()));
        Assert.False(error.TryGetProperty("requestId", out _));
        return error;
    }
}
