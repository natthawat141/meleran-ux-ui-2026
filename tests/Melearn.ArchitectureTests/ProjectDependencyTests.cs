using System.Xml.Linq;

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

    private static string FindRoot()
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);
        while (directory is not null && !File.Exists(Path.Combine(directory.FullName, "Melearn.slnx"))) directory = directory.Parent;
        return directory?.FullName ?? throw new InvalidOperationException("Solution root not found");
    }
}
