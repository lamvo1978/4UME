using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using System.Threading.RateLimiting;
using FourUme.Api;
using FourUme.Application.Activity;
using FourUme.Application.Admin;
using FourUme.Application.Auth;
using FourUme.Application.Grammar;
using FourUme.Application.Listening;
using FourUme.Application.Notifications;
using FourUme.Application.Placement;
using FourUme.Application.Review;
using FourUme.Application.Vocabulary;
using FourUme.Domain.Enums;
using FourUme.Infrastructure;
using FourUme.Infrastructure.Auth;
using FourUme.Infrastructure.Persistence;
using FourUme.Infrastructure.Media;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.FileProviders;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddInfrastructure(builder.Configuration);
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<IClientClock, HttpClientClock>();
builder.Services.AddScoped<ICurrentAdmin, HttpCurrentAdmin>();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var jwt = builder.Configuration.GetSection(JwtOptions.SectionName).Get<JwtOptions>()
    ?? throw new InvalidOperationException("Jwt config missing");
if (!builder.Environment.IsDevelopment() && (jwt.Key.Length < 32 || jwt.Key.Contains("dev-secret", StringComparison.Ordinal)))
{
    throw new InvalidOperationException("Jwt:Key must be a private random value of at least 32 characters outside Development.");
}

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
        // Tokens stay valid until expiry, so locked or deleted accounts are rejected here as well as at login.
        options.Events = new JwtBearerEvents
        {
            OnTokenValidated = async ctx =>
            {
                var access = ctx.HttpContext.RequestServices.GetRequiredService<IUserAccess>();
                var id = ctx.Principal is { } p ? GetUserId(p) : null;
                if (id is null || !await access.IsActiveAsync(id.Value, ctx.HttpContext.RequestAborted)) ctx.Fail("Account locked or removed.");
            },
        };
    });
builder.Services.AddAuthorization();

builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
        policy.AllowAnyHeader().AllowAnyMethod().AllowAnyOrigin());
});

// Each mailed code costs money and can be aimed at someone else's inbox, so cap sends per client IP
// (Cloudflare passes the visitor's address in CF-Connecting-IP).
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.OnRejected = async (ctx, ct) =>
        await ctx.HttpContext.Response.WriteAsJsonAsync(new { error = "Bạn thao tác quá nhanh, vui lòng thử lại sau ít phút." }, ct);
    options.AddPolicy(EmailCodeLimit, http => RateLimitPartition.GetFixedWindowLimiter(
        http.Request.Headers["CF-Connecting-IP"].FirstOrDefault() ?? http.Connection.RemoteIpAddress?.ToString() ?? "unknown",
        _ => new FixedWindowRateLimiterOptions { PermitLimit = 10, Window = TimeSpan.FromMinutes(15) }));
});

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}
app.UseCors();

var mediaPath = Path.GetFullPath(builder.Configuration[$"{MediaOptions.SectionName}:Path"] ?? "media");
Directory.CreateDirectory(mediaPath);
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(mediaPath),
    RequestPath = MediaOptions.UrlPrefix,
    OnPrepareResponse = ctx => ctx.Context.Response.Headers.CacheControl = "public, max-age=31536000, immutable",
});

app.UseAuthentication();
app.UseAuthorization();
app.UseRateLimiter();

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

    var vocabPath = builder.Configuration["Vocabulary:Path"];
    if (string.IsNullOrWhiteSpace(vocabPath))
    {
        vocabPath = Path.GetFullPath(Path.Combine(app.Environment.ContentRootPath, "..", "data", "vocabulary.json"));
    }
    await VocabularySeeder.SeedAsync(db, vocabPath, logger);

    var grammarPath = builder.Configuration["Grammar:Path"];
    if (string.IsNullOrWhiteSpace(grammarPath))
    {
        grammarPath = Path.GetFullPath(Path.Combine(app.Environment.ContentRootPath, "..", "data", "grammar"));
    }
    await GrammarSeeder.SeedAsync(db, grammarPath, logger);

    var listeningPath = builder.Configuration["Listening:Path"];
    if (string.IsNullOrWhiteSpace(listeningPath))
    {
        listeningPath = Path.GetFullPath(Path.Combine(app.Environment.ContentRootPath, "..", "data", "listening"));
    }
    await ListeningSeeder.SeedAsync(db, listeningPath, logger);
    await app.BootstrapAdminsAsync(logger);
}

app.MapAdminEndpoints();

app.MapGet("/", () => Results.Ok(new { app = "4UME", status = "ok" }));

app.MapPost("/api/auth/register/code", async (SendCodeRequest request, IAuthService auth) =>
{
    try
    {
        return Results.Ok(await auth.SendRegisterCodeAsync(request));
    }
    catch (InvalidOperationException ex)
    {
        return Results.BadRequest(new { error = ex.Message });
    }
}).RequireRateLimiting(EmailCodeLimit);

app.MapPost("/api/auth/password/code", async (SendCodeRequest request, IAuthService auth) =>
{
    try
    {
        return Results.Ok(await auth.SendResetCodeAsync(request));
    }
    catch (InvalidOperationException ex)
    {
        return Results.BadRequest(new { error = ex.Message });
    }
}).RequireRateLimiting(EmailCodeLimit);

app.MapPost("/api/auth/password/reset", async (ResetPasswordRequest request, IAuthService auth) =>
{
    try
    {
        return Results.Ok(await auth.ResetPasswordAsync(request));
    }
    catch (InvalidOperationException ex)
    {
        return Results.BadRequest(new { error = ex.Message });
    }
});

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

app.MapGet("/api/me/stats", async (ClaimsPrincipal principal, IActivityService activity) =>
{
    var userId = GetUserId(principal);
    if (userId is null) return Results.Unauthorized();
    return Results.Ok(await activity.GetStatsAsync(userId.Value));
}).RequireAuthorization();

app.MapPut("/api/me/settings", async (UpdateSettingsRequest request, ClaimsPrincipal principal, IAuthService auth) =>
{
    var userId = GetUserId(principal);
    if (userId is null) return Results.Unauthorized();
    try
    {
        return Results.Ok(await auth.UpdateSettingsAsync(userId.Value, request));
    }
    catch (InvalidOperationException ex)
    {
        return Results.BadRequest(new { error = ex.Message });
    }
}).RequireAuthorization();

app.MapPost("/api/me/password", async (ChangePasswordRequest request, ClaimsPrincipal principal, IAuthService auth) =>
{
    var userId = GetUserId(principal);
    if (userId is null) return Results.Unauthorized();
    try
    {
        await auth.ChangePasswordAsync(userId.Value, request);
        return Results.NoContent();
    }
    catch (InvalidOperationException ex)
    {
        return Results.BadRequest(new { error = ex.Message });
    }
}).RequireAuthorization();

app.MapPost("/api/me/delete", async (DeleteAccountRequest request, ClaimsPrincipal principal, IAuthService auth) =>
{
    var userId = GetUserId(principal);
    if (userId is null) return Results.Unauthorized();
    try
    {
        await auth.DeleteAccountAsync(userId.Value, request);
        return Results.NoContent();
    }
    catch (InvalidOperationException ex)
    {
        return Results.BadRequest(new { error = ex.Message });
    }
}).RequireAuthorization();

app.MapPost("/api/me/devices", async (RegisterDeviceRequest request, ClaimsPrincipal principal, INotificationService notifications) =>
{
    var userId = GetUserId(principal);
    if (userId is null) return Results.Unauthorized();
    try
    {
        await notifications.RegisterDeviceAsync(userId.Value, request);
        return Results.NoContent();
    }
    catch (InvalidOperationException ex)
    {
        return Results.BadRequest(new { error = ex.Message });
    }
}).RequireAuthorization();

app.MapDelete("/api/me/devices/{token}", async (string token, ClaimsPrincipal principal, INotificationService notifications) =>
{
    var userId = GetUserId(principal);
    if (userId is null) return Results.Unauthorized();
    await notifications.RemoveDeviceAsync(userId.Value, token);
    return Results.NoContent();
}).RequireAuthorization();

app.MapGet("/api/config", async (INotificationService notifications, IListeningService listening) =>
    Results.Ok(new AppConfigDto(await notifications.GetConfigAsync(), await listening.GetConfigAsync())));

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

app.MapGet("/api/vocabulary/search", async (ClaimsPrincipal principal, IVocabularyService vocab, string? q, int? limit) =>
{
    var userId = GetUserId(principal);
    if (userId is null) return Results.Unauthorized();
    return Results.Ok(await vocab.SearchAsync(userId.Value, q ?? "", limit ?? 30));
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

app.MapGet("/api/placement/questions", async (IPlacementService placement, CancellationToken ct) =>
    Results.Ok(await placement.GetQuestionsAsync(ct))).RequireAuthorization();

app.MapPost("/api/placement/apply", async (ApplyPlacementRequest request, ClaimsPrincipal principal, IPlacementService placement, CancellationToken ct) =>
{
    var userId = GetUserId(principal);
    if (userId is null) return Results.Unauthorized();
    try
    {
        return Results.Ok(await placement.ApplyAsync(userId.Value, request, ct));
    }
    catch (InvalidOperationException ex)
    {
        return Results.BadRequest(new { error = ex.Message });
    }
}).RequireAuthorization();

app.MapGet("/api/review/summary", async (ClaimsPrincipal principal, IReviewService review) =>
{
    var userId = GetUserId(principal);
    if (userId is null) return Results.Unauthorized();
    return Results.Ok(await review.GetSummaryAsync(userId.Value));
}).RequireAuthorization();

app.MapGet("/api/review/forecast", async (ClaimsPrincipal principal, IReviewService review, int? days) =>
{
    var userId = GetUserId(principal);
    if (userId is null) return Results.Unauthorized();
    return Results.Ok(await review.GetForecastAsync(userId.Value, days ?? 7));
}).RequireAuthorization();

app.MapGet("/api/review/due", async (ClaimsPrincipal principal, IReviewService review, int? limit) =>
{
    var userId = GetUserId(principal);
    if (userId is null) return Results.Unauthorized();
    return Results.Ok(await review.GetDueItemsAsync(userId.Value, limit ?? 10));
}).RequireAuthorization();

app.MapPost("/api/review/answer", async (ReviewAnswerRequest request, ClaimsPrincipal principal, IReviewService review) =>
{
    var userId = GetUserId(principal);
    if (userId is null) return Results.Unauthorized();
    try
    {
        return Results.Ok(await review.AnswerAsync(userId.Value, request));
    }
    catch (InvalidOperationException ex)
    {
        return Results.BadRequest(new { error = ex.Message });
    }
}).RequireAuthorization();

app.MapGet("/api/review/practice", async (ClaimsPrincipal principal, IReviewService review, string? deckId, string? wordIds, int? limit) =>
{
    var userId = GetUserId(principal);
    if (userId is null) return Results.Unauthorized();
    var ids = wordIds?.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
    return Results.Ok(await review.GetPracticeItemsAsync(userId.Value, new PracticeQuery(deckId, ids, limit ?? 10)));
}).RequireAuthorization();

app.MapPost("/api/review/practice/answer", async (ReviewAnswerRequest request, ClaimsPrincipal principal, IReviewService review) =>
{
    var userId = GetUserId(principal);
    if (userId is null) return Results.Unauthorized();
    try
    {
        return Results.Ok(await review.PracticeAnswerAsync(userId.Value, request));
    }
    catch (InvalidOperationException ex)
    {
        return Results.BadRequest(new { error = ex.Message });
    }
}).RequireAuthorization();

app.MapGet("/api/listening", async (ClaimsPrincipal principal, IListeningService listening, CancellationToken ct) =>
{
    var userId = GetUserId(principal);
    if (userId is null) return Results.Unauthorized();
    return Results.Ok(await listening.GetLessonsAsync(userId.Value, ct));
}).RequireAuthorization();

app.MapGet("/api/listening/{slug}", async (string slug, ClaimsPrincipal principal, IListeningService listening, CancellationToken ct) =>
{
    var userId = GetUserId(principal);
    if (userId is null) return Results.Unauthorized();
    return await listening.GetLessonAsync(userId.Value, slug, ct) is { } lesson
        ? Results.Ok(lesson)
        : Results.NotFound(new { error = "Không tìm thấy bài." });
}).RequireAuthorization();

app.MapPut("/api/listening/{slug}/progress", async (string slug, UpdateListeningProgressRequest request, ClaimsPrincipal principal, IListeningService listening, CancellationToken ct) =>
{
    var userId = GetUserId(principal);
    if (userId is null) return Results.Unauthorized();
    return await listening.UpdateProgressAsync(userId.Value, slug, request, ct) is { } progress
        ? Results.Ok(progress)
        : Results.NotFound(new { error = "Không tìm thấy bài." });
}).RequireAuthorization();

app.MapGet("/api/grammar/lessons", async (ClaimsPrincipal principal, IGrammarService grammar) =>
{
    var userId = GetUserId(principal);
    if (userId is null) return Results.Unauthorized();
    return Results.Ok(await grammar.GetLessonsAsync(userId.Value));
}).RequireAuthorization();

app.MapGet("/api/grammar/lessons/{slug}", async (string slug, ClaimsPrincipal principal, IGrammarService grammar) =>
{
    var userId = GetUserId(principal);
    if (userId is null) return Results.Unauthorized();
    var lesson = await grammar.GetLessonAsync(userId.Value, slug);
    return lesson is null ? Results.NotFound(new { error = "Không tìm thấy bài." }) : Results.Ok(lesson);
}).RequireAuthorization();

app.MapPost("/api/grammar/lessons/{slug}/complete", async (string slug, GrammarCompleteRequest request, ClaimsPrincipal principal, IGrammarService grammar) =>
{
    var userId = GetUserId(principal);
    if (userId is null) return Results.Unauthorized();
    try
    {
        return Results.Ok(await grammar.CompleteAsync(userId.Value, slug, request));
    }
    catch (InvalidOperationException ex)
    {
        return Results.BadRequest(new { error = ex.Message });
    }
}).RequireAuthorization();

app.MapGet("/api/grammar/review/summary", async (ClaimsPrincipal principal, IGrammarService grammar) =>
{
    var userId = GetUserId(principal);
    if (userId is null) return Results.Unauthorized();
    return Results.Ok(await grammar.GetReviewSummaryAsync(userId.Value));
}).RequireAuthorization();

app.MapGet("/api/grammar/review/due", async (ClaimsPrincipal principal, IGrammarService grammar, int? limit) =>
{
    var userId = GetUserId(principal);
    if (userId is null) return Results.Unauthorized();
    return Results.Ok(await grammar.GetDueAsync(userId.Value, limit ?? 5));
}).RequireAuthorization();

app.MapGet("/api/grammar/review/practice", async (ClaimsPrincipal principal, IGrammarService grammar, string? slug, int? limit) =>
{
    var userId = GetUserId(principal);
    if (userId is null) return Results.Unauthorized();
    return Results.Ok(await grammar.GetPracticeAsync(userId.Value, slug, limit ?? 4));
}).RequireAuthorization();

app.MapPost("/api/grammar/review/answer", async (GrammarReviewAnswerRequest request, ClaimsPrincipal principal, IGrammarService grammar) =>
{
    var userId = GetUserId(principal);
    if (userId is null) return Results.Unauthorized();
    try
    {
        return Results.Ok(await grammar.AnswerReviewAsync(userId.Value, request));
    }
    catch (InvalidOperationException ex)
    {
        return Results.BadRequest(new { error = ex.Message });
    }
}).RequireAuthorization();

app.MapPost("/api/grammar/review/practice/answer", async (GrammarReviewAnswerRequest request, ClaimsPrincipal principal, IGrammarService grammar) =>
{
    var userId = GetUserId(principal);
    if (userId is null) return Results.Unauthorized();
    try
    {
        return Results.Ok(await grammar.AnswerPracticeAsync(userId.Value, request));
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
public partial class Program
{
    private const string EmailCodeLimit = "email-code";
}
