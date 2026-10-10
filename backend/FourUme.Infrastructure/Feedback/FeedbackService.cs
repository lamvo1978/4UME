using FourUme.Application.Abstractions;
using FourUme.Application.Feedback;
using FourUme.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace FourUme.Infrastructure.Feedback;

public class FeedbackService(IAppDbContext db, IFeedbackSettingsService settings, FeedbackShared shared) : IFeedbackService
{
    public async Task<List<FeedbackTicketSummaryDto>> ListAsync(Guid userId, CancellationToken ct = default)
    {
        await shared.CloseStaleAsync(ct);
        var rows = await db.FeedbackTickets.AsNoTracking()
            .Where(t => t.UserId == userId)
            .OrderByDescending(t => t.LastMessageAt)
            .Select(t => new { t.Id, t.Category, t.Subject, t.Status, t.UserUnread, t.CreatedAt, t.LastMessageAt, t.WordId })
            .ToListAsync(ct);
        var wordIds = rows.Where(r => r.WordId != null).Select(r => r.WordId!).Distinct().ToList();
        var words = await db.Words.AsNoTracking().Where(w => wordIds.Contains(w.Id)).ToDictionaryAsync(w => w.Id, w => w.Text, ct);
        return rows.Select(r => new FeedbackTicketSummaryDto(
            r.Id, r.Category, r.Subject, r.Status, r.UserUnread, r.CreatedAt, r.LastMessageAt,
            r.WordId is not null && words.TryGetValue(r.WordId, out var text) ? text : null)).ToList();
    }

    public async Task<FeedbackUnreadDto> UnreadAsync(Guid userId, CancellationToken ct = default) =>
        new(await db.FeedbackTickets.CountAsync(t => t.UserId == userId && t.UserUnread, ct));

    public async Task<FeedbackTicketDto> GetAsync(Guid userId, Guid ticketId, CancellationToken ct = default)
    {
        await shared.CloseStaleAsync(ct);
        var ticket = await FindAsync(userId, ticketId, ct);
        if (ticket.UserUnread)
        {
            ticket.UserUnread = false;
            await db.SaveChangesAsync(ct);
        }
        return await ToDtoAsync(ticket, ct);
    }

    public async Task<FeedbackTicketDto> CreateAsync(
        Guid userId, CreateFeedbackRequest request, IReadOnlyList<FeedbackUpload> images, CancellationToken ct = default)
    {
        var category = FeedbackCategories.All.Contains(request.Category) ? request.Category : FeedbackCategories.Idea;
        var body = FeedbackShared.CleanBody(request.Body);
        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == userId, ct) ?? throw new FeedbackException(401, "Không tìm thấy tài khoản.");

        var since = DateTimeOffset.UtcNow.AddDays(-1);
        var limit = (await settings.GetAsync(ct)).DailyLimit;
        if (await db.FeedbackTickets.CountAsync(t => t.UserId == userId && t.CreatedAt > since, ct) >= limit)
            throw new FeedbackException(429, $"Bạn đã gửi {limit} góp ý trong 24 giờ qua. Bạn có thể trả lời thêm trong góp ý cũ, hoặc quay lại sau nhé.");
        await EnsureMessageBudgetAsync(userId, ct);

        string? wordId = null;
        if (!string.IsNullOrWhiteSpace(request.WordId))
        {
            wordId = await db.Words.AsNoTracking().Where(w => w.Id == request.WordId).Select(w => w.Id).FirstOrDefaultAsync(ct);
        }

        var urls = shared.SaveImages(images);
        var message = new FeedbackMessage { Body = body, Images = urls };
        var ticket = new FeedbackTicket
        {
            UserId = userId,
            Category = category,
            Subject = FeedbackRules.Subject(body),
            Status = FeedbackStatuses.Open,
            WordId = wordId,
            AppVersion = Clip(request.AppVersion, 32),
            Platform = Clip(request.Platform, 16),
            Device = Clip(request.Device, 120),
            AdminUnread = true,
            Messages = [message],
        };
        db.FeedbackTickets.Add(ticket);
        await db.SaveChangesAsync(ct);

        await shared.NotifyStaffAsync(ticket, user, message, isNew: true, ct);
        return await ToDtoAsync(ticket, ct);
    }

    public async Task<FeedbackTicketDto> ReplyAsync(
        Guid userId, Guid ticketId, string body, IReadOnlyList<FeedbackUpload> images, CancellationToken ct = default)
    {
        var text = FeedbackShared.CleanBody(body);
        var ticket = await FindAsync(userId, ticketId, ct);
        if (ticket.Status == FeedbackStatuses.Closed)
            throw new FeedbackException(409, "Góp ý này đã đóng. Bạn gửi góp ý mới giúp mình nhé.");
        await EnsureMessageBudgetAsync(userId, ct);

        var message = new FeedbackMessage { TicketId = ticket.Id, Body = text, Images = shared.SaveImages(images) };
        db.FeedbackMessages.Add(message);
        ticket.Status = FeedbackStatuses.Open;
        ticket.AdminUnread = true;
        ticket.UserUnread = false;
        ticket.LastMessageAt = message.CreatedAt;
        await db.SaveChangesAsync(ct);

        var user = await db.Users.AsNoTracking().FirstAsync(u => u.Id == userId, ct);
        await shared.NotifyStaffAsync(ticket, user, message, isNew: false, ct);
        return await ToDtoAsync(ticket, ct);
    }

    public async Task<FeedbackTicketDto> ResolveAsync(Guid userId, Guid ticketId, CancellationToken ct = default)
    {
        var ticket = await FindAsync(userId, ticketId, ct);
        if (ticket.Status != FeedbackStatuses.Closed)
        {
            ticket.Status = FeedbackStatuses.Closed;
            ticket.ClosedAt = DateTimeOffset.UtcNow;
            ticket.ClosedBy = "user";
            ticket.UserUnread = false;
            await db.SaveChangesAsync(ct);
        }
        return await ToDtoAsync(ticket, ct);
    }

    public async Task DeleteUserFilesAsync(Guid userId, CancellationToken ct = default)
    {
        var images = await db.FeedbackMessages.AsNoTracking()
            .Where(m => m.Ticket.UserId == userId)
            .Select(m => m.Images)
            .ToListAsync(ct);
        shared.DeleteImages(images.SelectMany(i => i));
    }

    private async Task EnsureMessageBudgetAsync(Guid userId, CancellationToken ct)
    {
        var since = DateTimeOffset.UtcNow.AddDays(-1);
        var sent = await db.FeedbackMessages.CountAsync(m => !m.FromAdmin && m.Ticket.UserId == userId && m.CreatedAt > since, ct);
        if (sent >= FeedbackRules.MaxMessagesPerDay)
            throw new FeedbackException(429, "Bạn đã gửi khá nhiều tin trong 24 giờ qua, quay lại sau giúp mình nhé.");
    }

    private async Task<FeedbackTicket> FindAsync(Guid userId, Guid ticketId, CancellationToken ct) =>
        await db.FeedbackTickets.FirstOrDefaultAsync(t => t.Id == ticketId && t.UserId == userId, ct)
            ?? throw new FeedbackException(404, "Không tìm thấy góp ý.");

    private async Task<FeedbackTicketDto> ToDtoAsync(FeedbackTicket t, CancellationToken ct)
    {
        var messages = await db.FeedbackMessages.AsNoTracking()
            .Where(m => m.TicketId == t.Id)
            .OrderBy(m => m.CreatedAt)
            .ToListAsync(ct);
        return new FeedbackTicketDto(t.Id, t.Category, t.Subject, t.Status, t.ClosedBy, t.CreatedAt, t.LastMessageAt,
            await shared.WordAsync(t.WordId, ct), messages.Select(FeedbackShared.ToDto).ToList());
    }

    private static string? Clip(string? value, int max)
    {
        var v = value?.Trim();
        return string.IsNullOrEmpty(v) ? null : v.Length <= max ? v : v[..max];
    }
}
