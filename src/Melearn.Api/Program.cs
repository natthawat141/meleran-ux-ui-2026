using Melearn.Api.Configuration;
using Melearn.Api.Middleware;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddApiFoundation();

var app = builder.Build();
app.UseExceptionHandler();
app.UseApiStatusCodeResponses();
app.MapControllers();
app.Run();

// Entry point for integration tests; contains no business logic.
public partial class Program { }
