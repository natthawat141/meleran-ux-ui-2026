using System.Globalization;
using System.Text.Json;

namespace Melearn.IntegrationTests;

// Checks the keywords used by the selected canonical response schemas, not a general OpenAPI validator.
internal static class AccountContractAssertions
{
    private static readonly JsonDocument Contract = JsonDocument.Parse(File.ReadAllText(
        Path.Combine(AppContext.BaseDirectory, "Fixtures", "account-management-contract.json")));

    public static void Response(string operation, JsonElement value) => Schema(
        Contract.RootElement.GetProperty("operations").GetProperty(operation).GetProperty("success_schema"), value);

    public static void Named(string name, JsonElement value) => Schema(
        Contract.RootElement.GetProperty("schemas").GetProperty(name), value);

    private static void Schema(JsonElement schema, JsonElement value) => Assert.True(Matches(schema, value),
        $"Response does not match the selected canonical schema: {value}");

    private static bool Matches(JsonElement schema, JsonElement value)
    {
        if (schema.TryGetProperty("$ref", out var reference))
            return Matches(Contract.RootElement.GetProperty("schemas").GetProperty(reference.GetString()!.Split('/')[^1]), value);
        if (schema.TryGetProperty("anyOf", out var alternatives))
            return alternatives.EnumerateArray().Any(option => Matches(option, value));
        if (schema.TryGetProperty("enum", out var values)
            && !values.EnumerateArray().Any(option => option.GetRawText() == value.GetRawText())) return false;
        if (!schema.TryGetProperty("type", out var type)) return true;
        switch (type.GetString())
        {
            case "null": return value.ValueKind == JsonValueKind.Null;
            case "boolean": return value.ValueKind is JsonValueKind.True or JsonValueKind.False;
            case "string":
                if (value.ValueKind != JsonValueKind.String) return false;
                var text = value.GetString()!;
                if (schema.TryGetProperty("minLength", out var min) && text.Length < min.GetInt32()) return false;
                if (schema.TryGetProperty("maxLength", out var max) && text.Length > max.GetInt32()) return false;
                return !schema.TryGetProperty("format", out var format) || format.GetString() != "date-time"
                    || DateTimeOffset.TryParse(text, CultureInfo.InvariantCulture, DateTimeStyles.RoundtripKind, out _);
            case "array":
                return value.ValueKind == JsonValueKind.Array && (!schema.TryGetProperty("items", out var items)
                    || value.EnumerateArray().All(item => Matches(items, item)));
            case "object":
                if (value.ValueKind != JsonValueKind.Object) return false;
                if (schema.TryGetProperty("required", out var required)
                    && required.EnumerateArray().Any(field => !value.TryGetProperty(field.GetString()!, out _))) return false;
                var hasProperties = schema.TryGetProperty("properties", out var properties);
                foreach (var field in value.EnumerateObject())
                {
                    if (hasProperties && properties.TryGetProperty(field.Name, out var fieldSchema))
                    {
                        if (!Matches(fieldSchema, field.Value)) return false;
                    }
                    else if (schema.TryGetProperty("additionalProperties", out var additional) && additional.ValueKind == JsonValueKind.False) return false;
                }
                return true;
            default: throw new InvalidOperationException($"Unsupported fixture keyword/type: {type}");
        }
    }
}
