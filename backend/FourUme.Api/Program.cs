using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using System.Threading.RateLimiting;
using FourUme.Api;
using FourUme.Application.About;
using FourUme.Application.Premium;
using FourUme.Application.Activity;
using FourUme.Application.Admin;
using FourUme.Application.Auth;
using FourUme.Application.Conversations;
using FourUme.Application.Feedback;
using FourUme.Application.Grammar;
using FourUme.Application.Invites;
using FourUme.Application.Listening;
using FourUme.Application.Notifications;
using FourUme.Application.Placement;
using FourUme.Application.Practice;
using FourUme.Application.Speech;
using FourUme.Application.Pronunciation;
using FourUme.Application.Review;
using FourUme.Application.Vocabulary;
using FourUme.Application.Writing;
using FourUme.Domain.Enums;
using FourUme.Infrastructure;
using FourUme.Infrastructure.Auth;
using FourUme.Infrastructure.Conversations;
using FourUme.Infrastructure.Writing;
using FourUme.Infrastructure.Persistence;
using FourUme.Infrastructure.Media;
using FourUme.Infrastructure.Pronunciation;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.FileProviders;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);

// Only with Sentry:Dsn set (VPS .env); no request bodies, user data or tracing.
if (!string.IsNullOrWhiteSpace(builder.Configuration["Sentry:Dsn"]))
{
    builder.WebHost.UseSentry(o =>
    {
        o.SendDefaultPii = false;
        o.TracesSampleRate = 0;
    });
}

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

// Each mailed code costs money and can be aimed at someone else's inbox, and logins can be used to guess
// passwords, so both are capped per client IP.
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.OnRejected = async (ctx, ct) =>
        await ctx.HttpContext.Response.WriteAsJsonAsync(new { error = "Bạn thao tác quá nhanh, vui lòng thử lại sau ít phút." }, ct);
    options.AddPolicy(EmailCodeLimit, http => RateLimitPartition.GetFixedWindowLimiter(
        ClientIp(http),
        _ => new FixedWindowRateLimiterOptions { PermitLimit = 10, Window = TimeSpan.FromMinutes(15) }));
    options.AddPolicy(LoginLimit, http => RateLimitPartition.GetFixedWindowLimiter(
        ClientIp(http),
        _ => new FixedWindowRateLimiterOptions { PermitLimit = 20, Window = TimeSpan.FromMinutes(15) }));
    // Partner codes unlock Premium, so guessing them is capped per account (or per IP without one).
    options.AddPolicy(RedeemLimit, http => RateLimitPartition.GetFixedWindowLimiter(
        GetUserId(http.User)?.ToString() ?? ClientIp(http),
        _ => new FixedWindowRateLimiterOptions { PermitLimit = 10, Window = TimeSpan.FromMinutes(15) }));
    // Every conversation turn is an AI call; a person speaking can't send more than a few a minute.
    options.AddPolicy(ConversationLimit, http => RateLimitPartition.GetFixedWindowLimiter(
        GetUserId(http.User)?.ToString() ?? ClientIp(http),
        _ => new FixedWindowRateLimiterOptions { PermitLimit = 15, Window = TimeSpan.FromMinutes(1) }));
    // Each grading is a long AI call; nobody writes a paragraph in under a minute.
    options.AddPolicy(WritingLimit, http => RateLimitPartition.GetFixedWindowLimiter(
        GetUserId(http.User)?.ToString() ?? ClientIp(http),
        _ => new FixedWindowRateLimiterOptions { PermitLimit = 5, Window = TimeSpan.FromMinutes(1) }));
});

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}
app.UseCors();

// A client that hangs up mid-request is not a server error; keep it out of the logs and Sentry.
app.Use(async (ctx, next) =>
{
    try
    {
        await next();
    }
    catch (OperationCanceledException) when (ctx.RequestAborted.IsCancellationRequested)
    {
        if (!ctx.Response.HasStarted) ctx.Response.StatusCode = 499;
    }
});

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

    var conversationPath = builder.Configuration["Conversation:Path"];
    if (string.IsNullOrWhiteSpace(conversationPath))
    {
        conversationPath = Path.GetFullPath(Path.Combine(app.Environment.ContentRootPath, "..", "data", "conversation", "scenarios.json"));
    }
    await ConversationSeeder.SeedAsync(db, conversationPath, logger);

    var writingPath = builder.Configuration["Writing:Path"];
    if (string.IsNullOrWhiteSpace(writingPath))
    {
        writingPath = Path.GetFullPath(Path.Combine(app.Environment.ContentRootPath, "..", "data", "writing", "prompts.json"));
    }
    await WritingSeeder.SeedAsync(db, writingPath, logger);
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
}).RequireRateLimiting(LoginLimit);

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

app.MapGet("/api/me/weekly", async (ClaimsPrincipal principal, IActivityService activity, int? weeks, CancellationToken ct) =>
{
    var userId = GetUserId(principal);
    if (userId is null) return Results.Unauthorized();
    return Results.Ok(await activity.GetWeeklyAsync(userId.Value, weeks ?? 2, ct));
}).RequireAuthorization();

app.MapGet("/api/me/referral", async (ClaimsPrincipal principal, IReferralService referrals, CancellationToken ct) =>
{
    var userId = GetUserId(principal);
    if (userId is null) return Results.Unauthorized();
    try
    {
        return Results.Ok(await referrals.GetMineAsync(userId.Value, ct));
    }
    catch (InvalidOperationException ex)
    {
        return Results.BadRequest(new { error = ex.Message });
    }
}).RequireAuthorization();

// One box in the app for both kinds of code; the server tells them apart.
app.MapPost("/api/codes/redeem", async (RedeemCodeRequest request, ClaimsPrincipal principal, IReferralService referrals, CancellationToken ct) =>
{
    var userId = GetUserId(principal);
    if (userId is null) return Results.Unauthorized();
    try
    {
        return Results.Ok(await referrals.RedeemAsync(userId.Value, request.Code, ct));
    }
    catch (InvalidOperationException ex)
    {
        return Results.BadRequest(new { error = ex.Message });
    }
}).RequireAuthorization().RequireRateLimiting(RedeemLimit);

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

app.MapPost("/api/me/notifications/opened", async (NotificationOpenedRequest request, ClaimsPrincipal principal, IPushNotifier push, CancellationToken ct) =>
{
    var userId = GetUserId(principal);
    if (userId is null) return Results.Unauthorized();
    await push.MarkOpenedAsync(userId.Value, request.LogId, request.BroadcastId, ct);
    return Results.NoContent();
}).RequireAuthorization();

app.MapGet("/api/config", async (INotificationService notifications, IListeningService listening, IStreakFreezeSettings streakFreeze) =>
    Results.Ok(new AppConfigDto(
        await notifications.GetConfigAsync(),
        await listening.GetConfigAsync(),
        await notifications.GetTextsAsync(),
        await streakFreeze.GetAsync())));

app.MapGet("/api/about", async (IAboutService about, CancellationToken ct) => Results.Ok(AboutRules.Visible(await about.GetAsync(ct))));
app.MapGet("/api/premium-perks", async (IPremiumPerksService perks, CancellationToken ct) =>
    Results.Ok(PremiumPerkRules.Visible(await perks.GetAsync(ct))));

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

app.MapGet("/api/placement/grammar", async (IPlacementService placement, CancellationToken ct) =>
    Results.Ok(await placement.GetGrammarQuestionsAsync(ct))).RequireAuthorization();

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

app.MapGet("/api/pronunciation/status", async (ClaimsPrincipal principal, IPronunciationService pronunciation, CancellationToken ct) =>
{
    var userId = GetUserId(principal);
    if (userId is null) return Results.Unauthorized();
    return Results.Ok(await pronunciation.GetStatusAsync(userId.Value, ct));
}).RequireAuthorization();

// multipart/form-data: "wordId" and the recording in "audio".
app.MapPost("/api/pronunciation/assess", async (HttpRequest request, ClaimsPrincipal principal, IPronunciationService pronunciation, CancellationToken ct) =>
{
    var userId = GetUserId(principal);
    if (userId is null) return Results.Unauthorized();
    if (!request.HasFormContentType) return Results.BadRequest(new { error = "Thiếu bản ghi âm." });
    var form = await request.ReadFormAsync(ct);
    var file = form.Files["audio"];
    var wordId = form["wordId"].ToString();
    if (file is null || string.IsNullOrWhiteSpace(wordId)) return Results.BadRequest(new { error = "Thiếu bản ghi âm." });
    try
    {
        await using var audio = file.OpenReadStream();
        return Results.Ok(await pronunciation.AssessAsync(userId.Value, wordId, audio, ct));
    }
    catch (PronunciationException ex)
    {
        return Results.Json(new { error = ex.Message }, statusCode: ex.StatusCode);
    }
}).RequireAuthorization();

// AdMob server-side verification callback (set as the rewarded ad unit's SSV URL). The app passes
// user_id = the learner's id and custom_data = their local date (yyyy-MM-dd) when it loads the ad.
app.MapGet("/api/ads/admob-reward", async (HttpRequest request, AdMobRewardVerifier verifier, IPronunciationService pronunciation,
    ILogger<Program> logger, CancellationToken ct) =>
{
    var raw = request.QueryString.Value?.TrimStart('?') ?? "";
    if (!await verifier.VerifyAsync(raw, ct)) return Results.StatusCode(StatusCodes.Status403Forbidden);

    // The console's "Verify URL" test sends a signed callback without a user.
    if (!Guid.TryParse(request.Query["user_id"], out var userId)) return Results.Ok();
    var transactionId = request.Query["transaction_id"].ToString();
    if (string.IsNullOrEmpty(transactionId) || transactionId.Length > 128) return Results.Ok();

    var utcToday = DateOnly.FromDateTime(DateTime.UtcNow);
    var localDate = DateOnly.TryParseExact(request.Query["custom_data"].ToString(), "yyyy-MM-dd", out var d)
        && d >= utcToday.AddDays(-1) && d <= utcToday.AddDays(1)
            ? d
            : DateOnly.FromDateTime(DateTime.UtcNow.AddHours(7));
    var outcome = await pronunciation.GrantAdRewardAsync(userId, localDate, transactionId, "admob", ct);
    logger.LogInformation("AdMob reward {Outcome} for {UserId}", outcome, userId);
    // Always 200 once the signature is valid, so AdMob does not keep retrying a reward we chose not to count.
    return Results.Ok();
});

if (app.Environment.IsDevelopment())
{
    // Stands in for a watched ad while the app runs in Expo Go, which has no ad SDK.
    app.MapPost("/api/ads/dev-reward", async (ClaimsPrincipal principal, IClientClock clock, IPronunciationService pronunciation, CancellationToken ct) =>
    {
        var userId = GetUserId(principal);
        if (userId is null) return Results.Unauthorized();
        await pronunciation.GrantAdRewardAsync(userId.Value, clock.Today, $"dev-{Guid.NewGuid():N}", "dev", ct);
        return Results.Ok(await pronunciation.GetStatusAsync(userId.Value, ct));
    }).RequireAuthorization();
}

var feedback = app.MapGroup("/api/feedback").RequireAuthorization().AddEndpointFilter(async (ctx, next) =>
{
    try
    {
        return await next(ctx);
    }
    catch (FeedbackException ex)
    {
        return Results.Json(new { error = ex.Message }, statusCode: ex.StatusCode);
    }
});

feedback.MapGet("", async (ClaimsPrincipal principal, IFeedbackService s, CancellationToken ct) =>
    GetUserId(principal) is { } userId ? Results.Ok(await s.ListAsync(userId, ct)) : Results.Unauthorized());

feedback.MapGet("/unread", async (ClaimsPrincipal principal, IFeedbackService s, CancellationToken ct) =>
    GetUserId(principal) is { } userId ? Results.Ok(await s.UnreadAsync(userId, ct)) : Results.Unauthorized());

feedback.MapGet("/{id:guid}", async (Guid id, ClaimsPrincipal principal, IFeedbackService s, CancellationToken ct) =>
    GetUserId(principal) is { } userId ? Results.Ok(await s.GetAsync(userId, id, ct)) : Results.Unauthorized());

feedback.MapPost("", async (HttpRequest request, ClaimsPrincipal principal, IFeedbackService s, CancellationToken ct) =>
{
    if (GetUserId(principal) is not { } userId) return Results.Unauthorized();
    var form = await ReadFeedbackFormAsync(request, ct);
    var body = new CreateFeedbackRequest(
        form["category"].ToString(), form["body"].ToString(), NullIfEmpty(form["wordId"]),
        NullIfEmpty(form["appVersion"]), NullIfEmpty(form["platform"]), NullIfEmpty(form["device"]));
    return Results.Ok(await s.CreateAsync(userId, body, FeedbackUploads(form), ct));
});

feedback.MapPost("/{id:guid}/messages", async (Guid id, HttpRequest request, ClaimsPrincipal principal, IFeedbackService s, CancellationToken ct) =>
{
    if (GetUserId(principal) is not { } userId) return Results.Unauthorized();
    var form = await ReadFeedbackFormAsync(request, ct);
    return Results.Ok(await s.ReplyAsync(userId, id, form["body"].ToString(), FeedbackUploads(form), ct));
});

feedback.MapPost("/{id:guid}/resolve", async (Guid id, ClaimsPrincipal principal, IFeedbackService s, CancellationToken ct) =>
    GetUserId(principal) is { } userId ? Results.Ok(await s.ResolveAsync(userId, id, ct)) : Results.Unauthorized());

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

app.MapGet("/api/review/practice", async (ClaimsPrincipal principal, IReviewService review, string? deckId, string? wordIds, int? limit, bool? weak) =>
{
    var userId = GetUserId(principal);
    if (userId is null) return Results.Unauthorized();
    var ids = wordIds?.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
    return Results.Ok(await review.GetPracticeItemsAsync(userId.Value, new PracticeQuery(deckId, ids, limit ?? 10, weak ?? false)));
}).RequireAuthorization();

app.MapGet("/api/review/weak", async (ClaimsPrincipal principal, IReviewService review) =>
{
    var userId = GetUserId(principal);
    if (userId is null) return Results.Unauthorized();
    return Results.Ok(await review.GetWeakWordsAsync(userId.Value));
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

app.MapPost("/api/listening/{slug}/dictation", async (string slug, ClaimsPrincipal principal, IListeningService listening, CancellationToken ct) =>
{
    var userId = GetUserId(principal);
    if (userId is null) return Results.Unauthorized();
    return await listening.RecordDictationAsync(userId.Value, slug, ct)
        ? Results.NoContent()
        : Results.NotFound(new { error = "Không tìm thấy bài." });
}).RequireAuthorization();

app.MapGet("/api/speech/word", async (string text, string voice, IWordAudioService words, CancellationToken ct) =>
    Results.Ok(await words.GetAsync(text, voice, ct))).RequireAuthorization();

app.MapGet("/api/conversation/status", async (ClaimsPrincipal principal, IConversationService conversation, CancellationToken ct) =>
{
    var userId = GetUserId(principal);
    if (userId is null) return Results.Unauthorized();
    return Results.Ok(await conversation.GetStatusAsync(userId.Value, ct));
}).RequireAuthorization();

app.MapGet("/api/conversation/scenarios", async (IConversationService conversation, CancellationToken ct) =>
    Results.Ok(await conversation.GetScenariosAsync(ct))).RequireAuthorization();

app.MapPost("/api/conversation", async (StartConversationRequest request, ClaimsPrincipal principal, IConversationService conversation, CancellationToken ct) =>
{
    var userId = GetUserId(principal);
    if (userId is null) return Results.Unauthorized();
    try
    {
        return Results.Ok(await conversation.StartAsync(userId.Value, request, ct));
    }
    catch (ConversationException ex)
    {
        return Results.Json(new { error = ex.Message }, statusCode: ex.StatusCode);
    }
}).RequireAuthorization().RequireRateLimiting(ConversationLimit);

app.MapPost("/api/conversation/{id:guid}/turns", async (Guid id, SendConversationTurnRequest request, ClaimsPrincipal principal,
    IConversationService conversation, CancellationToken ct) =>
{
    var userId = GetUserId(principal);
    if (userId is null) return Results.Unauthorized();
    try
    {
        return Results.Ok(await conversation.SendAsync(userId.Value, id, request.Text, ct));
    }
    catch (ConversationException ex)
    {
        return Results.Json(new { error = ex.Message }, statusCode: ex.StatusCode);
    }
}).RequireAuthorization().RequireRateLimiting(ConversationLimit);

app.MapPost("/api/conversation/{id:guid}/end", async (Guid id, ClaimsPrincipal principal, IConversationService conversation, CancellationToken ct) =>
{
    var userId = GetUserId(principal);
    if (userId is null) return Results.Unauthorized();
    try
    {
        return Results.Ok(await conversation.EndAsync(userId.Value, id, ct));
    }
    catch (ConversationException ex)
    {
        return Results.Json(new { error = ex.Message }, statusCode: ex.StatusCode);
    }
}).RequireAuthorization().RequireRateLimiting(ConversationLimit);

app.MapGet("/api/writing/status", async (ClaimsPrincipal principal, IWritingService writing, CancellationToken ct) =>
{
    var userId = GetUserId(principal);
    if (userId is null) return Results.Unauthorized();
    return Results.Ok(await writing.GetStatusAsync(userId.Value, ct));
}).RequireAuthorization();

app.MapGet("/api/writing/prompts", async (IWritingService writing, CancellationToken ct) =>
    Results.Ok(await writing.GetPromptsAsync(ct))).RequireAuthorization();

app.MapPost("/api/writing/submissions", async (SubmitWritingRequest request, ClaimsPrincipal principal, IWritingService writing, CancellationToken ct) =>
{
    var userId = GetUserId(principal);
    if (userId is null) return Results.Unauthorized();
    try
    {
        return Results.Ok(await writing.SubmitAsync(userId.Value, request, ct));
    }
    catch (WritingException ex)
    {
        return Results.Json(new { error = ex.Message, code = ex.Code }, statusCode: ex.StatusCode);
    }
}).RequireAuthorization().RequireRateLimiting(WritingLimit);

app.MapGet("/api/writing/submissions", async (ClaimsPrincipal principal, IWritingService writing, CancellationToken ct) =>
{
    var userId = GetUserId(principal);
    if (userId is null) return Results.Unauthorized();
    return Results.Ok(await writing.GetHistoryAsync(userId.Value, ct));
}).RequireAuthorization();

app.MapGet("/api/writing/submissions/{id:guid}", async (Guid id, ClaimsPrincipal principal, IWritingService writing, CancellationToken ct) =>
{
    var userId = GetUserId(principal);
    if (userId is null) return Results.Unauthorized();
    try
    {
        return Results.Ok(await writing.GetAsync(userId.Value, id, ct));
    }
    catch (WritingException ex)
    {
        return Results.Json(new { error = ex.Message, code = ex.Code }, statusCode: ex.StatusCode);
    }
}).RequireAuthorization();

app.MapDelete("/api/writing/submissions/{id:guid}", async (Guid id, ClaimsPrincipal principal, IWritingService writing, CancellationToken ct) =>
{
    var userId = GetUserId(principal);
    if (userId is null) return Results.Unauthorized();
    try
    {
        await writing.DeleteAsync(userId.Value, id, ct);
        return Results.NoContent();
    }
    catch (WritingException ex)
    {
        return Results.Json(new { error = ex.Message, code = ex.Code }, statusCode: ex.StatusCode);
    }
}).RequireAuthorization();

app.MapGet("/api/practice", async (ClaimsPrincipal principal, IPracticeService practice, CancellationToken ct) =>
{
    var userId = GetUserId(principal);
    if (userId is null) return Results.Unauthorized();
    return Results.Ok(await practice.GetOverviewAsync(userId.Value, ct));
}).RequireAuthorization();

app.MapGet("/api/practice/sentences", async (string level, int? count, ClaimsPrincipal principal, IPracticeService practice, CancellationToken ct) =>
{
    var userId = GetUserId(principal);
    if (userId is null) return Results.Unauthorized();
    return await practice.GetRoundAsync(userId.Value, level, count ?? PracticeRules.RoundSize, ct) is { } round
        ? Results.Ok(round)
        : Results.Json(new { error = "Luyện câu dành cho Premium hoặc ngày được tặng khi giữ chuỗi." }, statusCode: StatusCodes.Status403Forbidden);
}).RequireAuthorization();

app.MapPost("/api/practice/record", async (ClaimsPrincipal principal, IPracticeService practice, CancellationToken ct) =>
{
    var userId = GetUserId(principal);
    if (userId is null) return Results.Unauthorized();
    await practice.RecordAsync(userId.Value, ct);
    return Results.NoContent();
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

app.MapGet("/api/grammar/mixed", async (ClaimsPrincipal principal, IGrammarService grammar, string? scope, int? limit) =>
{
    var userId = GetUserId(principal);
    if (userId is null) return Results.Unauthorized();
    try
    {
        return Results.Ok(await grammar.GetMixedAsync(userId.Value, scope ?? GrammarMixedScopes.Learned, limit ?? 6));
    }
    catch (InvalidOperationException ex)
    {
        return Results.BadRequest(new { error = ex.Message });
    }
}).RequireAuthorization();

app.MapPost("/api/grammar/mixed/complete", async (GrammarMixedCompleteRequest request, ClaimsPrincipal principal, IGrammarService grammar) =>
{
    var userId = GetUserId(principal);
    if (userId is null) return Results.Unauthorized();
    return Results.Ok(await grammar.CompleteMixedAsync(userId.Value, request));
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

static async Task<IFormCollection> ReadFeedbackFormAsync(HttpRequest request, CancellationToken ct)
{
    if (!request.HasFormContentType) throw new FeedbackException(400, "Cần gửi dạng multipart/form-data.");
    return await request.ReadFormAsync(ct);
}

static List<FeedbackUpload> FeedbackUploads(IFormCollection form) =>
    form.Files.GetFiles("images")
        .Where(f => f.Length > 0)
        .Select(f => new FeedbackUpload(f.OpenReadStream(), f.FileName))
        .ToList();

static string? NullIfEmpty(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

// Make Program visible for tests if needed
public partial class Program
{
    private const string EmailCodeLimit = "email-code";
    private const string LoginLimit = "login";
    private const string RedeemLimit = "redeem";
    private const string ConversationLimit = "conversation";
    private const string WritingLimit = "writing";

    /// <summary>
    /// The visitor's address. The edge nginx overwrites X-Real-IP with the connecting address, so it can't be
    /// forged through the proxy; without it (local runs) the socket address is used.
    /// </summary>
    private static string ClientIp(HttpContext http) =>
        http.Request.Headers["X-Real-IP"].FirstOrDefault() ?? http.Connection.RemoteIpAddress?.ToString() ?? "unknown";
}
