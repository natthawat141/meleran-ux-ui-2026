using System.Xml.Linq;
using System.Text.Json;

namespace Melearn.ArchitectureTests;

public sealed class ProjectDependencyTests
{
    private static readonly IReadOnlyDictionary<string, string[]> Allowed =
        new Dictionary<string, string[]>
        {
            ["Melearn.Domain"] = [],
            ["Melearn.Application"] = ["Melearn.Domain"],
            ["Melearn.Infrastructure"] = ["Melearn.Application", "Melearn.Domain"],
            ["Melearn.Api"] = ["Melearn.Application", "Melearn.Infrastructure"]
        };

    [Theory]
    [InlineData("Melearn.Domain")]
    [InlineData("Melearn.Application")]
    [InlineData("Melearn.Infrastructure")]
    [InlineData("Melearn.Api")]
    public void Project_references_follow_the_approved_direction(string project)
    {
        var document = XDocument.Load(Path.Combine(FindRoot(), "src", project, $"{project}.csproj"));
        var actual = document.Descendants("ProjectReference")
            .Select(element => Path.GetFileNameWithoutExtension(
                element.Attribute("Include")!.Value.Replace('\\', '/'))).Order().ToArray();
        Assert.Equal(Allowed[project].Order().ToArray(), actual);
        if (project is "Melearn.Domain" or "Melearn.Application")
        {
            Assert.Empty(document.Descendants("FrameworkReference"));
            Assert.DoesNotContain(document.Descendants("PackageReference"), element =>
            {
                var name = element.Attribute("Include")!.Value;
                return name.Contains("AspNetCore", StringComparison.OrdinalIgnoreCase)
                    || name.Contains("EntityFramework", StringComparison.OrdinalIgnoreCase);
            });
        }
    }

    [Fact]
    public void Api_features_do_not_import_infrastructure()
    {
        foreach (var path in Directory.GetFiles(Path.Combine(FindRoot(), "src", "Melearn.Api", "Features"), "*.cs", SearchOption.AllDirectories))
            Assert.DoesNotContain("Melearn.Infrastructure", File.ReadAllText(path));
    }

    [Fact]
    public void OpenRouter_model_and_key_must_not_be_defined_in_appsettings()
    {
        var apiRoot = Path.Combine(FindRoot(), "src", "Melearn.Api");
        foreach (var path in Directory.GetFiles(apiRoot, "appsettings*.json", SearchOption.TopDirectoryOnly))
        {
            using var document = JsonDocument.Parse(File.ReadAllText(path));
            if (!document.RootElement.TryGetProperty("OpenRouter", out var router)) continue;
            Assert.False(router.TryGetProperty("Model", out _), "Select OpenRouter model through environment configuration; no JSON fallback is allowed.");
            Assert.False(router.TryGetProperty("ApiKey", out _), "OpenRouter API key belongs in secret/environment configuration.");
        }
    }

    private static string FindRoot()
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);
        while (directory is not null && !File.Exists(Path.Combine(directory.FullName, "Melearn.slnx"))) directory = directory.Parent;
        return directory?.FullName ?? throw new InvalidOperationException("Solution root not found");
    }
}
