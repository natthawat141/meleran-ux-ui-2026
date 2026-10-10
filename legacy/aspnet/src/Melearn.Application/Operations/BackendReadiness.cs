namespace Melearn.Application.Operations;

// Host readiness is separate from frontend/mock acceptance.
// Replace this baseline with real capability checks as features are implemented.
public sealed record BackendReadiness(bool Ready, IReadOnlyList<string> MissingCapabilities)
{
    public static BackendReadiness Foundation { get; } = new(
        false,
        Array.AsReadOnly(new[] { "identity", "persistence", "business_endpoints" }));
}
