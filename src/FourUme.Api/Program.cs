using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using FourUme.Application.Auth;
using FourUme.Application.Grammar;
using FourUme.Application.Vocabulary;
using FourUme.Domain.Enums;
using FourUme.Infrastructure;
using FourUme.Infrastructure.Auth;
using FourUme.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddInfrastructure(builder.Configuration);
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var jwt = builder.Configuration.GetSection(JwtOptions.SectionName).Get<JwtOptions>()
    ?? throw new InvalidOperationException("Jwt config missing");

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateIssuerSigningKey = true,
            ValidateLifetime = true,
            ValidIssuer = jwt.Issuer,
            ValidAudience = jwt.Audience,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwt.Key))
        };
    });
builder.Services.AddAuthorization();

builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
        policy.AllowAnyHeader().AllowAnyMethod().AllowAnyOrigin());
});

var app = builder.Build();

app.UseSwagger();
app.UseSwaggerUI();
app.UseCors();
app.UseAuthentication();
app.UseAuthorization();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    var logger = scope.ServiceProvider.GetRequiredService<ILoggerFactory>().CreateLogger("Startup");
    var retries = 0;
    while (true)
    {
        try
        {
            await db.Database.MigrateAsync();
            break;
        }
        catch (Exception ex) when (retries < 20)
        {
            retries++;
            logger.LogWarning(ex, "Waiting for database... attempt {Attempt}", retries);
            await Task.Delay(1500);
        }
    }

    var vocabPath = builder.Configuration["Vocabulary:Path"]
        ?? Path.GetFullPath(Path.Combine(app.Environment.ContentRootPath, "..", "..", "data", "vocabulary.json"));
    await VocabularySeeder.SeedAsync(db, vocabPath, logger);
}

app.MapGet("/", () => Results.Ok(new { app = "4UME", status = "ok" }));

app.MapPost("/api/auth/register", async (RegisterRequest request, IAuthService auth) =>
{
    try
    {
        return Results.Ok(await auth.RegisterAsync(request));
    }
    catch (InvalidOperationException ex)
    {
        return Results.BadRequest(new { error = ex.Message });
    }
});

app.MapPost("/api/auth/login", async (LoginRequest request, IAuthService auth) =>
{
    try
    {
        return Results.Ok(await auth.LoginAsync(request));
    }
    catch (InvalidOperationException ex)
    {
        return Results.BadRequest(new { error = ex.Message });
    }
});

app.MapGet("/api/me", async (ClaimsPrincipal principal, IAuthService auth) =>
{
    var userId = GetUserId(principal);
    if (userId is null) return Results.Unauthorized();
    return Results.Ok(await auth.GetMeAsync(userId.Value));
}).RequireAuthorization();

app.MapGet("/api/vocabulary/decks", async (ClaimsPrincipal principal, IVocabularyService vocab, string? level) =>
{
    var userId = GetUserId(principal);
    if (userId is null) return Results.Unauthorized();
    return Results.Ok(await vocab.GetDecksAsync(userId.Value, level));
}).RequireAuthorization();

app.MapGet("/api/vocabulary/decks/{deckId}", async (string deckId, ClaimsPrincipal principal, IVocabularyService vocab) =>
{
    var userId = GetUserId(principal);
    if (userId is null) return Results.Unauthorized();
    return Results.Ok(await vocab.GetDeckWordsAsync(userId.Value, deckId));
}).RequireAuthorization();

app.MapPost("/api/vocabulary/progress", async (UpdateProgressRequest request, ClaimsPrincipal principal, IVocabularyService vocab) =>
{
    var userId = GetUserId(principal);
    if (userId is null) return Results.Unauthorized();
    if (!Enum.IsDefined(request.Status) || request.Status is not (WordStatus.New or WordStatus.Hard or WordStatus.Known))
    {
        return Results.BadRequest(new { error = "Status không hợp lệ." });
    }

    try
    {
        return Results.Ok(await vocab.UpdateProgressAsync(userId.Value, request));
    }
    catch (InvalidOperationException ex)
    {
        return Results.BadRequest(new { error = ex.Message });
    }
}).RequireAuthorization();

app.MapGet("/api/grammar/lessons", async (ClaimsPrincipal principal, IGrammarService grammar) =>
{
    var userId = GetUserId(principal);
    if (userId is null) return Results.Unauthorized();
    return Results.Ok(await grammar.GetLessonsAsync(userId.Value));
}).RequireAuthorization();

app.MapGet("/api/grammar/lessons/{slug}", async (string slug, IGrammarService grammar) =>
{
    var lesson = await grammar.GetLessonAsync(slug);
    return lesson is null ? Results.NotFound(new { error = "Không tìm thấy bài." }) : Results.Ok(lesson);
}).RequireAuthorization();

app.MapPost("/api/grammar/lessons/{slug}/submit", async (string slug, GrammarSubmitRequest request, ClaimsPrincipal principal, IGrammarService grammar) =>
{
    var userId = GetUserId(principal);
    if (userId is null) return Results.Unauthorized();
    try
    {
        return Results.Ok(await grammar.SubmitAsync(userId.Value, slug, request));
    }
    catch (InvalidOperationException ex)
    {
        return Results.BadRequest(new { error = ex.Message });
    }
}).RequireAuthorization();

app.Run();

static Guid? GetUserId(ClaimsPrincipal principal)
{
    var sub = principal.FindFirstValue(ClaimTypes.NameIdentifier)
        ?? principal.FindFirstValue(JwtRegisteredClaimNames.Sub)
        ?? principal.FindFirstValue("sub");
    return Guid.TryParse(sub, out var id) ? id : null;
}

// Make Program visible for tests if needed
public partial class Program;
