using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using FourUme.Application.About;
using FourUme.Application.Activity;
using FourUme.Application.Admin;
using FourUme.Application.Grammar;
using FourUme.Application.Listening;
using FourUme.Application.Notifications;
using FourUme.Application.Pronunciation;

namespace FourUme.Api;

/// <summary>Endpoints under /api/admin, reachable only by unlocked admin accounts (re-checked against the database per request).</summary>
public static class AdminEndpoints
{
    public const string AdminKey = "admin";

    public static void MapAdminEndpoints(this WebApplication app)
    {
        var admin = app.MapGroup("/api/admin").RequireAuthorization().AddEndpointFilter(async (ctx, next) =>
        {
            var http = ctx.HttpContext;
            var sub = http.User.FindFirstValue(ClaimTypes.NameIdentifier) ?? http.User.FindFirstValue(JwtRegisteredClaimNames.Sub);
            if (!Guid.TryParse(sub, out var userId)) return Results.Unauthorized();
            var identity = await http.RequestServices.GetRequiredService<IAdminService>().GetAdminAsync(userId, http.RequestAborted);
            if (identity is null) return Results.Json(new { error = "Tài khoản không có quyền quản trị." }, statusCode: StatusCodes.Status403Forbidden);
            http.Items[AdminKey] = identity;
            try
            {
                return await next(ctx);
            }
            catch (InvalidOperationException ex)
            {
                return Results.BadRequest(new { error = ex.Message });
            }
            catch (ContentConflictException ex)
            {
                return Results.Conflict(new { error = ex.Message });
            }
            catch (KeyNotFoundException)
            {
                return Results.NotFound(new { error = "Không tìm thấy." });
            }
        });

        admin.MapGet("/me", (HttpContext http) => Results.Ok(Admin(http)));

        admin.MapGet("/overview", async (IAdminService service, IClientClock clock, CancellationToken ct) =>
            Results.Ok(await service.GetOverviewAsync(clock.Today, clock.Offset, ct)));

        admin.MapGet("/users", async ([AsParameters] AdminUserQuery q, IAdminUserService s, IClientClock clock, CancellationToken ct) =>
            Results.Ok(await s.GetUsersAsync(q, clock.Today, ct)));
        admin.MapGet("/users/{id:guid}", async (Guid id, IAdminUserService s, IClientClock clock, CancellationToken ct) =>
            await s.GetUserAsync(id, clock.Today, ct) is { } u ? Results.Ok(u) : Results.NotFound(new { error = "Không tìm thấy người dùng." }));
        admin.MapPost("/users", async (CreateUserRequest r, IAdminUserService s, IClientClock clock, CancellationToken ct) =>
        {
            var created = await s.CreateAsync(r, clock.Today, ct);
            return Results.Created($"/api/admin/users/{created.User.Id}", created);
        });
        admin.MapPut("/users/{id:guid}/role", async (Guid id, SetRoleRequest r, IAdminUserService s, IClientClock clock, CancellationToken ct) =>
            Results.Ok(await s.SetRoleAsync(id, r.Role, clock.Today, ct)));
        admin.MapPut("/users/{id:guid}/lock", async (Guid id, SetLockRequest r, IAdminUserService s, IClientClock clock, CancellationToken ct) =>
            Results.Ok(await s.SetLockedAsync(id, r.Locked, clock.Today, ct)));
        admin.MapPut("/users/{id:guid}/premium", async (Guid id, SetPremiumRequest r, IAdminUserService s, IClientClock clock, CancellationToken ct) =>
            Results.Ok(await s.SetPremiumAsync(id, r.Until, clock.Today, ct)));

        admin.MapGet("/settings", async (IAdminSettingsService s, CancellationToken ct) => Results.Ok(await s.GetAsync(ct)));
        admin.MapPut("/settings/notifications", async (NotificationConfig c, IAdminSettingsService s, CancellationToken ct) =>
            Results.Ok(await s.SaveNotificationsAsync(c, ct)));
        admin.MapPost("/settings/notifications/reset", async (IAdminSettingsService s, CancellationToken ct) =>
            Results.Ok(await s.ResetNotificationsAsync(ct)));
        admin.MapPut("/settings/listening", async (ListeningConfig c, IAdminSettingsService s, CancellationToken ct) =>
            Results.Ok(await s.SaveListeningAsync(c, ct)));
        admin.MapPost("/settings/listening/reset", async (IAdminSettingsService s, CancellationToken ct) =>
            Results.Ok(await s.ResetListeningAsync(ct)));
        admin.MapPut("/settings/pronunciation", async (PronunciationConfig c, IAdminSettingsService s, CancellationToken ct) =>
            Results.Ok(await s.SavePronunciationAsync(c, ct)));
        admin.MapPost("/settings/pronunciation/reset", async (IAdminSettingsService s, CancellationToken ct) =>
            Results.Ok(await s.ResetPronunciationAsync(ct)));
        admin.MapGet("/about", async (IAdminSettingsService s, CancellationToken ct) => Results.Ok(await s.GetAboutAsync(ct)));
        admin.MapPut("/about", async (AboutContent c, IAdminSettingsService s, CancellationToken ct) =>
            Results.Ok(await s.SaveAboutAsync(c, ct)));
        admin.MapPost("/about/reset", async (IAdminSettingsService s, CancellationToken ct) =>
            Results.Ok(await s.ResetAboutAsync(ct)));

        admin.MapGet("/vocabulary/meta", async (IAdminContentService s, CancellationToken ct) => Results.Ok(await s.GetMetaAsync(ct)));

        admin.MapGet("/decks", async (IAdminContentService s, CancellationToken ct) => Results.Ok(await s.GetDecksAsync(ct)));
        admin.MapPost("/decks", async (SaveDeckRequest r, IAdminContentService s, CancellationToken ct) =>
            Results.Ok(await s.CreateDeckAsync(r, ct)));
        admin.MapPut("/decks/order", async (ReorderRequest r, IAdminContentService s, CancellationToken ct) =>
        {
            await s.ReorderDecksAsync(r, ct);
            return Results.NoContent();
        });
        admin.MapPut("/decks/{id}", async (string id, SaveDeckRequest r, IAdminContentService s, CancellationToken ct) =>
            Results.Ok(await s.UpdateDeckAsync(id, r, ct)));
        admin.MapDelete("/decks/{id}", async (string id, IAdminContentService s, CancellationToken ct) =>
        {
            await s.DeleteDeckAsync(id, ct);
            return Results.NoContent();
        });

        admin.MapGet("/words", async ([AsParameters] AdminWordQuery q, IAdminContentService s, CancellationToken ct) =>
            Results.Ok(await s.GetWordsAsync(q, ct)));
        admin.MapGet("/words/export", async ([AsParameters] AdminWordQuery q, IAdminContentService s, CancellationToken ct) =>
            Results.Ok(await s.ExportWordsAsync(q, ct)));
        admin.MapPost("/words/import", async (ImportWordsRequest r, IAdminContentService s, CancellationToken ct) =>
            Results.Ok(await s.ImportWordsAsync(r, ct)));
        admin.MapGet("/words/{id}", async (string id, IAdminContentService s, CancellationToken ct) =>
            await s.GetWordAsync(id, ct) is { } w ? Results.Ok(w) : Results.NotFound(new { error = "Không tìm thấy từ." }));
        admin.MapPost("/words", async (SaveWordRequest r, IAdminContentService s, CancellationToken ct) =>
            Results.Ok(await s.CreateWordAsync(r, ct)));
        admin.MapPut("/words/{id}", async (string id, SaveWordRequest r, IAdminContentService s, CancellationToken ct) =>
            Results.Ok(await s.UpdateWordAsync(id, r, ct)));
        admin.MapDelete("/words/{id}", async (string id, IAdminContentService s, CancellationToken ct) =>
        {
            await s.DeleteWordAsync(id, ct);
            return Results.NoContent();
        });

        admin.MapGet("/grammar", async (IAdminGrammarService s, CancellationToken ct) => Results.Ok(await s.GetLessonsAsync(ct)));
        admin.MapGet("/grammar/export", async (IAdminGrammarService s, CancellationToken ct) =>
            Results.Json(await s.ExportLessonsAsync(ct), GrammarJson.Options));
        admin.MapPost("/grammar/import", async (ImportGrammarRequest r, IAdminGrammarService s, CancellationToken ct) =>
            Results.Ok(await s.ImportLessonsAsync(r, ct)));
        admin.MapGet("/grammar/{slug}", async (string slug, IAdminGrammarService s, CancellationToken ct) =>
            await s.GetLessonAsync(slug, ct) is { } l ? Results.Ok(l) : Results.NotFound(new { error = "Không tìm thấy bài." }));
        admin.MapPost("/grammar", async (GrammarLessonDocument doc, IAdminGrammarService s, CancellationToken ct) =>
            Results.Ok(await s.CreateLessonAsync(doc, ct)));
        admin.MapPost("/grammar/validate", (GrammarLessonDocument doc) =>
            Results.Ok(new GrammarValidationDto(GrammarValidator.Validate(doc))));
        admin.MapPut("/grammar/order", async (ReorderRequest r, IAdminGrammarService s, CancellationToken ct) =>
        {
            await s.ReorderLessonsAsync(r, ct);
            return Results.NoContent();
        });
        admin.MapPut("/grammar/{slug}", async (string slug, GrammarLessonDocument doc, IAdminGrammarService s, CancellationToken ct) =>
            Results.Ok(await s.UpdateLessonAsync(slug, doc, ct)));
        admin.MapDelete("/grammar/{slug}", async (string slug, IAdminGrammarService s, CancellationToken ct) =>
        {
            await s.DeleteLessonAsync(slug, ct);
            return Results.NoContent();
        });

        admin.MapGet("/listening", async (IAdminListeningService s, CancellationToken ct) => Results.Ok(await s.GetLessonsAsync(ct)));
        admin.MapGet("/listening/export", async (IAdminListeningService s, CancellationToken ct) =>
            Results.Json(await s.ExportLessonsAsync(ct), GrammarJson.Options));
        admin.MapPost("/listening/import", async (ImportListeningRequest r, IAdminListeningService s, CancellationToken ct) =>
            Results.Ok(await s.ImportLessonsAsync(r, ct)));
        admin.MapGet("/listening/speech", async (IAdminListeningService s, CancellationToken ct) =>
            Results.Ok(await s.GetSpeechStatusAsync(ct)));
        admin.MapPost("/listening/speech/preview", async (VoicePreviewRequest r, IAdminListeningService s, CancellationToken ct) =>
            Results.File(await s.PreviewVoiceAsync(r, ct), "audio/mpeg"));
        admin.MapGet("/listening/draft", (IListeningDraftService s) => Results.Ok(s.GetStatus()));
        admin.MapPost("/listening/draft", async (ListeningDraftRequest r, IListeningDraftService s, CancellationToken ct) =>
            Results.Ok(await s.DraftAsync(r, ct)));
        admin.MapPost("/listening/validate", (ListeningLessonDocument doc) =>
            Results.Ok(new ListeningValidationDto(ListeningRules.Validate(ListeningRules.Normalize(doc)))));
        admin.MapPut("/listening/order", async (ReorderRequest r, IAdminListeningService s, CancellationToken ct) =>
        {
            await s.ReorderLessonsAsync(r, ct);
            return Results.NoContent();
        });
        admin.MapGet("/listening/{slug}", async (string slug, IAdminListeningService s, CancellationToken ct) =>
            await s.GetLessonAsync(slug, ct) is { } l ? Results.Ok(l) : Results.NotFound(new { error = "Không tìm thấy bài." }));
        admin.MapPost("/listening", async (ListeningLessonDocument doc, IAdminListeningService s, CancellationToken ct) =>
            Results.Ok(await s.CreateLessonAsync(doc, ct)));
        admin.MapPut("/listening/{slug}", async (string slug, ListeningLessonDocument doc, IAdminListeningService s, CancellationToken ct) =>
            Results.Ok(await s.UpdateLessonAsync(slug, doc, ct)));
        admin.MapDelete("/listening/{slug}", async (string slug, IAdminListeningService s, CancellationToken ct) =>
        {
            await s.DeleteLessonAsync(slug, ct);
            return Results.NoContent();
        });
        admin.MapPost("/listening/{slug}/audio", async (string slug, IAdminListeningService s, CancellationToken ct) =>
            Results.Ok(await s.GenerateAudioAsync(slug, ct)));

        admin.MapGet("/media", async (IAdminContentService s, CancellationToken ct) => Results.Ok(await s.GetMediaAsync(ct)));
        // Form read manually (not IFormFile binding) so the JWT-only API doesn't need antiforgery tokens.
        admin.MapPost("/media", async (HttpRequest req, IAdminContentService s, CancellationToken ct) =>
        {
            if (!req.HasFormContentType) return Results.BadRequest(new { error = "Cần gửi ảnh dạng multipart/form-data." });
            var form = await req.ReadFormAsync(ct);
            var file = form.Files["file"];
            if (file is null || file.Length == 0) return Results.BadRequest(new { error = "Chưa chọn ảnh." });
            var crop = !string.Equals(form["crop"], "false", StringComparison.OrdinalIgnoreCase);
            await using var stream = file.OpenReadStream();
            return Results.Ok(await s.UploadMediaAsync(stream, file.FileName, crop, Admin(req.HttpContext).Id, ct));
        });
        admin.MapDelete("/media/{id:guid}", async (Guid id, IAdminContentService s, CancellationToken ct) =>
        {
            await s.DeleteMediaAsync(id, ct);
            return Results.NoContent();
        });

        admin.MapGet("/stock-images", async (string? q, int? page, IWordImageService s, CancellationToken ct) =>
            Results.Ok(await s.SearchAsync(q ?? "", page ?? 1, ct)));
        admin.MapPost("/stock-images/import", async (StockImageRef r, HttpContext http, IWordImageService s, CancellationToken ct) =>
            Results.Ok(await s.ImportAsync(r, Admin(http).Id, ct)));
        admin.MapPost("/words/auto-images", async (AutoImageRequest r, HttpContext http, IWordImageService s, CancellationToken ct) =>
            Results.Ok(await s.AutoAssignAsync(r, Admin(http).Id, ct)));
        admin.MapPut("/words/{id}/image", async (string id, StockImageRef r, HttpContext http, IWordImageService s, CancellationToken ct) =>
            Results.Ok(await s.AssignAsync(id, r, Admin(http).Id, ct)));
        admin.MapPost("/words/{id}/image/approve", async (string id, IWordImageService s, CancellationToken ct) =>
            Results.Ok(await s.ApproveAsync(id, ct)));
        admin.MapDelete("/words/{id}/image", async (string id, IWordImageService s, CancellationToken ct) =>
            Results.Ok(await s.RemoveAsync(id, ct)));

        admin.MapGet("/audit", async ([AsParameters] AuditQuery q, IAdminAuditService s, CancellationToken ct) =>
            Results.Ok(await s.GetEntriesAsync(q, ct)));
        admin.MapGet("/audit/{id:guid}", async (Guid id, IAdminAuditService s, CancellationToken ct) =>
            await s.GetEntryAsync(id, ct) is { } e ? Results.Ok(e) : Results.NotFound(new { error = "Không tìm thấy." }));
        admin.MapPost("/audit/{id:guid}/restore", async (Guid id, IAdminAuditService s, CancellationToken ct) =>
            Results.Ok(await s.RestoreAsync(id, ct)));
    }

    private static AdminIdentityDto Admin(HttpContext http) => (AdminIdentityDto)http.Items[AdminKey]!;

    /// <summary>
    /// Restores protected owner accounts, then grants admin to the emails in Admin:Emails (comma separated)
    /// for accounts that already exist.
    /// </summary>
    public static async Task BootstrapAdminsAsync(this WebApplication app, ILogger logger)
    {
        var emails = app.Configuration["Admin:Emails"]?.Split(',', StringSplitOptions.RemoveEmptyEntries) ?? [];
        using var scope = app.Services.CreateScope();
        var admins = scope.ServiceProvider.GetRequiredService<IAdminService>();
        if (app.Configuration["Admin:InitialPassword"] is { Length: > 0 } initialPassword)
        {
            var created = await admins.CreateMissingOwnersAsync(initialPassword);
            if (created > 0) logger.LogWarning("Created {Count} owner admin account(s) from Admin:InitialPassword; change the password after first login", created);
        }
        var granted = await admins.EnsureAdminsAsync(emails);
        if (granted > 0) logger.LogInformation("Granted admin role to {Count} account(s) from Admin:Emails", granted);
    }
}
