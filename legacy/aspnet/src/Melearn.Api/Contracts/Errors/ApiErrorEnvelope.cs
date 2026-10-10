using System.Text.Json.Serialization;

namespace Melearn.Api.Contracts.Errors;

// Mirrors the existing Frontend Draft error envelope. Never return database entities.
public sealed record ApiErrorEnvelope(ApiError Error)
{
    public static ApiErrorEnvelope Create(
        string code, string message, HttpContext context, object? details = null)
        => new(new ApiError(code, message, context.TraceIdentifier, details));
}

public sealed record ApiError(string Code, string Message, string RequestId,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] object? Details = null);
public sealed record ValidationField(string Field, string Code);
public sealed record ValidationDetails(IReadOnlyList<ValidationField> Fields);
