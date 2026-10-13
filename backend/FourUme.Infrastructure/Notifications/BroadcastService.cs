using FourUme.Application.Admin;
using FourUme.Application.Notifications;
using FourUme.Domain.Entities;
using FourUme.Infrastructure.Admin;
using FourUme.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using S = FourUme.Domain.Entities.BroadcastStatuses;

namespace FourUme.Infrastructure.Notifications;

/// <summary>
/// Admin "news" pushes. Recipients are fixed when sending starts; <see cref="RunAsync"/> (every few minutes, and right
/// away for "send now") delivers to those outside their quiet hours, claiming rows first so no one gets it twice.
/// </summary>
public class BroadcastService(
    AppDbContext db,
    INotificationService notifications,
    IPushNotifier push,
    ExpoPushClient expo,
    ICurrentAdmin admin,
    Auditor auditor,
    ILogger<BroadcastService> logger) : IBroadcastService
{
    private const string AuditType = "broadcast";
    /// <summary>Expo accepts at most 100 messages per request.</summary>
    private const int ExpoBatch = 100;
    private const int ClaimBatch = 200;
    private const int HistorySize = 50;
    private static readonly TimeSpan StaleClaim = TimeSpan.FromMinutes(10);

    public async Task<BroadcastEstimate> EstimateAsync(BroadcastAudienceRequest request, CancellationToken ct = default)
    {
        await ValidateAudienceAsync(request.Audience, request.PartnerId, ct);
        var users = Audience(request.Audience, request.PartnerId, DateTimeOffset.UtcNow);
        return new BroadcastEstimate(
            await users.CountAsync(ct),
            await users.CountAsync(u => u.NotifyNews && u.DeviceTokens.Any(), ct),
            await users.CountAsync(u => !u.NotifyNews && u.DeviceTokens.Any(), ct),
            await users.CountAsync(u => !u.DeviceTokens.Any(), ct));
    }

    public async Task<PushResult> SendTestAsync(BroadcastContent content, CancellationToken ct = default)
    {
        var c = Validate(content);
        var adminId = admin.Id ?? throw new InvalidOperationException("Không xác định được tài khoản quản trị.");
        return await push.SendToUserAsync(adminId, Message(c.Title, c.Body, c.Screen), ct);
    }

    public async Task<BroadcastDto> CreateAsync(CreateBroadcastRequest request, CancellationToken ct = default)
    {
        var c = Validate(new BroadcastContent(request.Title, request.Body, request.Screen));
        await ValidateAudienceAsync(request.Audience, request.PartnerId, ct);
        var now = DateTimeOffset.UtcNow;
        var at = request.ScheduledAt is { } s && s > now.AddMinutes(1) ? s : now;
        if (at - now > BroadcastRules.MaxScheduleAhead) throw new InvalidOperationException("Chỉ hẹn giờ trong vòng 30 ngày tới.");

        var b = new Broadcast
        {
            Title = c.Title, Body = c.Body, Screen = c.Screen, Audience = request.Audience,
            PartnerId = request.Audience == BroadcastAudiences.Partner ? request.PartnerId : null,
            ScheduledAt = at, CreatedBy = admin.Name,
        };
        db.Broadcasts.Add(b);
        auditor.Record(AuditType, b.Id.ToString(), AuditActions.Create, $"Gửi thông báo “{b.Title}”", null, Snapshot(b));
        await db.SaveChangesAsync(ct);

        // The request may be dropped by the browser; the send itself should still finish.
        if (at == now) await RunAsync(now, CancellationToken.None, b.Id);
        return await GetAsync(b.Id, ct);
    }

    public async Task<IReadOnlyList<BroadcastDto>> ListAsync(CancellationToken ct = default) =>
        await Dtos(db.Broadcasts.AsNoTracking().OrderByDescending(b => b.CreatedAt).Take(HistorySize)).ToListAsync(ct);

    public async Task<BroadcastDto> CancelAsync(Guid id, CancellationToken ct = default)
    {
        var b = await db.Broadcasts.FirstOrDefaultAsync(x => x.Id == id, ct) ?? throw new KeyNotFoundException();
        if (b.Status is S.Done or S.Cancelled) throw new InvalidOperationException("Đợt gửi này đã kết thúc.");
        var before = Snapshot(b);
        b.Status = S.Cancelled;
        b.FinishedAt = DateTimeOffset.UtcNow;
        auditor.Record(AuditType, b.Id.ToString(), AuditActions.Update, $"Huỷ gửi thông báo “{b.Title}”", before, Snapshot(b));
        await db.SaveChangesAsync(ct);
        await db.BroadcastRecipients.Where(r => r.BroadcastId == id && r.Status == S.Pending)
            .ExecuteUpdateAsync(x => x.SetProperty(r => r.Status, S.Cancelled), ct);
        return await GetAsync(id, ct);
    }

    /// <summary>Starts broadcasts whose time has come and delivers to whoever is outside quiet hours now.</summary>
    /// <param name="only">Limits the run to one broadcast (the one just created).</param>
    public async Task RunAsync(DateTimeOffset now, CancellationToken ct, Guid? only = null)
    {
        var due = await db.Broadcasts.AsNoTracking()
            .Where(b => b.Status == S.Scheduled && b.ScheduledAt <= now && (only == null || b.Id == only))
            .Select(b => b.Id).ToListAsync(ct);
        foreach (var id in due) await StartAsync(id, now, ct);

        var sending = await db.Broadcasts.AsNoTracking()
            .Where(b => b.Status == S.Sending && (only == null || b.Id == only))
            .ToListAsync(ct);
        if (sending.Count == 0) return;
        var config = await notifications.GetConfigAsync(ct);
        foreach (var b in sending)
        {
            try
            {
                await DeliverAsync(b, now, config, ct);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogWarning(ex, "Broadcast {BroadcastId} failed", b.Id);
            }
        }
    }

    /// <summary>Fixes the recipient list; the status change is the claim, so only one run does it.</summary>
    private async Task StartAsync(Guid id, DateTimeOffset now, CancellationToken ct)
    {
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        var claimed = await db.Broadcasts.Where(b => b.Id == id && b.Status == S.Scheduled)
            .ExecuteUpdateAsync(x => x.SetProperty(b => b.Status, S.Sending), ct);
        if (claimed == 0) return;
        var b = await db.Broadcasts.AsNoTracking().FirstAsync(x => x.Id == id, ct);
        var userIds = await Audience(b.Audience, b.PartnerId, now)
            .Where(u => u.NotifyNews && u.DeviceTokens.Any())
            .Select(u => u.Id).ToListAsync(ct);
        db.BroadcastRecipients.AddRange(userIds.Select(u => new BroadcastRecipient { BroadcastId = id, UserId = u }));
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
    }

    private async Task DeliverAsync(Broadcast b, DateTimeOffset now, NotificationConfig config, CancellationToken ct)
    {
        var stale = now - StaleClaim;
        await db.BroadcastRecipients.Where(r => r.BroadcastId == b.Id && r.Status == S.Sending && r.ClaimedAt < stale)
            .ExecuteUpdateAsync(x => x.SetProperty(r => r.Status, S.Pending).SetProperty(r => r.ClaimId, (Guid?)null), ct);

        if (now - b.ScheduledAt > BroadcastRules.DeliveryWindow)
        {
            await db.BroadcastRecipients.Where(r => r.BroadcastId == b.Id && r.Status == S.Pending)
                .ExecuteUpdateAsync(x => x.SetProperty(r => r.Status, S.Expired), ct);
        }
        else
        {
            var pending = await db.BroadcastRecipients.AsNoTracking()
                .Where(r => r.BroadcastId == b.Id && r.Status == S.Pending)
                .Select(r => new { r.Id, r.User.TimeZone })
                .ToListAsync(ct);
            var ready = pending
                .Where(p =>
                {
                    var local = PushNotifier.LocalNow(p.TimeZone, now);
                    return !PushNotifier.InQuietHours(local.Hour * 60 + local.Minute, config);
                })
                .Select(p => p.Id).ToList();
            var message = Message(b.Title, b.Body, b.Screen);
            foreach (var chunk in ready.Chunk(ClaimBatch)) await SendChunkAsync(b.Id, chunk, message, now, ct);
        }

        var open = await db.BroadcastRecipients.AnyAsync(r => r.BroadcastId == b.Id && (r.Status == S.Pending || r.Status == S.Sending), ct);
        if (!open)
        {
            await db.Broadcasts.Where(x => x.Id == b.Id && x.Status == S.Sending)
                .ExecuteUpdateAsync(x => x.SetProperty(y => y.Status, S.Done).SetProperty(y => y.FinishedAt, now), ct);
        }
    }

    private async Task SendChunkAsync(Guid broadcastId, Guid[] recipientIds, PushMessage message, DateTimeOffset now, CancellationToken ct)
    {
        var claim = Guid.NewGuid();
        await db.BroadcastRecipients.Where(r => recipientIds.Contains(r.Id) && r.Status == S.Pending)
            .ExecuteUpdateAsync(x => x
                .SetProperty(r => r.Status, S.Sending)
                .SetProperty(r => r.ClaimId, claim)
                .SetProperty(r => r.ClaimedAt, now), ct);
        var userIds = await db.BroadcastRecipients.Where(r => r.ClaimId == claim).Select(r => r.UserId).ToListAsync(ct);
        if (userIds.Count == 0) return;

        var devices = await db.DeviceTokens.Where(d => userIds.Contains(d.UserId)).ToListAsync(ct);
        var reached = new HashSet<Guid>();
        string? lastError = null;
        foreach (var batch in devices.Chunk(ExpoBatch))
        {
            var tickets = await expo.SendAsync(batch.Select(d => d.Token).ToList(), message, ct);
            for (var i = 0; i < batch.Length; i++)
            {
                if (tickets[i].Ok)
                {
                    reached.Add(batch[i].UserId);
                    continue;
                }
                lastError = tickets[i].Error;
                if (tickets[i].Unregistered) db.DeviceTokens.Remove(batch[i]);
            }
        }
        await db.SaveChangesAsync(ct);

        var reachedIds = reached.ToList();
        var sentAt = DateTimeOffset.UtcNow;
        await db.BroadcastRecipients.Where(r => r.ClaimId == claim && reachedIds.Contains(r.UserId))
            .ExecuteUpdateAsync(x => x.SetProperty(r => r.Status, S.Sent).SetProperty(r => r.SentAt, sentAt), ct);
        await db.BroadcastRecipients.Where(r => r.ClaimId == claim && r.Status == S.Sending)
            .ExecuteUpdateAsync(x => x.SetProperty(r => r.Status, S.Failed), ct);
        if (lastError is not null)
        {
            var error = lastError.Length > 300 ? lastError[..300] : lastError;
            await db.Broadcasts.Where(b => b.Id == broadcastId).ExecuteUpdateAsync(x => x.SetProperty(b => b.LastError, error), ct);
        }
    }

    /// <summary>Unlocked accounts in the group; callers narrow it to who can actually receive it.</summary>
    private IQueryable<User> Audience(string audience, Guid? partnerId, DateTimeOffset now)
    {
        var today = DateOnly.FromDateTime(PushNotifier.LocalNow(null, now).DateTime);
        var activeFrom = today.AddDays(-6);
        var inactiveFrom = today.AddDays(-(UserFilters.InactiveDays - 1));
        var users = db.Users.AsNoTracking().Where(u => u.LockedAt == null);
        return audience switch
        {
            BroadcastAudiences.Active => users.Where(u => u.StudyDays.Any(d => !d.Frozen && d.Date >= activeFrom)),
            BroadcastAudiences.Inactive => users.Where(u => !u.StudyDays.Any(d => !d.Frozen && d.Date >= inactiveFrom)),
            BroadcastAudiences.Premium => users.Where(u => u.PremiumUntil > now
                || db.PartnerCodes.Any(c => c.UsedById == u.Id && c.RevokedAt == null && (c.ExpiresAt == null || c.ExpiresAt > now))),
            BroadcastAudiences.Partner => users.Where(u => db.PartnerCodes.Any(c =>
                c.PartnerId == partnerId && c.UsedById == u.Id && c.RevokedAt == null && (c.ExpiresAt == null || c.ExpiresAt > now))),
            _ => users,
        };
    }

    private async Task ValidateAudienceAsync(string audience, Guid? partnerId, CancellationToken ct)
    {
        if (!BroadcastAudiences.Values.Contains(audience)) throw new InvalidOperationException("Nhóm người nhận không hợp lệ.");
        if (audience == BroadcastAudiences.Partner && (partnerId is null || !await db.Partners.AnyAsync(p => p.Id == partnerId, ct)))
            throw new InvalidOperationException("Chọn trung tâm đối tác.");
    }

    private static BroadcastContent Validate(BroadcastContent c)
    {
        var title = c.Title?.Trim() ?? "";
        var body = c.Body?.Trim() ?? "";
        var screen = c.Screen?.Trim() ?? "";
        if (title.Length == 0) throw new InvalidOperationException("Chưa có tiêu đề.");
        if (body.Length == 0) throw new InvalidOperationException("Chưa có nội dung.");
        if (title.Length > BroadcastRules.MaxTitle) throw new InvalidOperationException($"Tiêu đề tối đa {BroadcastRules.MaxTitle} ký tự.");
        if (body.Length > BroadcastRules.MaxBody) throw new InvalidOperationException($"Nội dung tối đa {BroadcastRules.MaxBody} ký tự.");
        if (!BroadcastScreens.Values.Contains(screen)) throw new InvalidOperationException("Màn hình mở khi chạm không hợp lệ.");
        return new BroadcastContent(title, body, screen);
    }

    private static PushMessage Message(string title, string body, string screen) =>
        new(title, body, screen.Length > 0 ? new Dictionary<string, string> { ["screen"] = screen } : new Dictionary<string, string>());

    private static object Snapshot(Broadcast b) =>
        new { b.Title, b.Body, b.Screen, b.Audience, b.PartnerId, b.ScheduledAt, b.Status };

    private async Task<BroadcastDto> GetAsync(Guid id, CancellationToken ct) =>
        await Dtos(db.Broadcasts.AsNoTracking().Where(b => b.Id == id)).FirstAsync(ct);

    private static IQueryable<BroadcastDto> Dtos(IQueryable<Broadcast> q) => q.Select(b => new BroadcastDto(
        b.Id, b.Title, b.Body, b.Screen, b.Audience, b.PartnerId, b.Partner != null ? b.Partner.Name : null,
        b.ScheduledAt, b.CreatedAt, b.CreatedBy, b.Status, b.FinishedAt,
        b.Recipients.Count(),
        b.Recipients.Count(r => r.Status == S.Sent),
        b.Recipients.Count(r => r.Status == S.Pending || r.Status == S.Sending),
        b.Recipients.Count(r => r.Status == S.Failed),
        b.Recipients.Count(r => r.Status == S.Expired || r.Status == S.Cancelled),
        b.LastError));
}
