using FourUme.Application.Abstractions;
using FourUme.Application.Admin;
using FourUme.Application.Feedback;
using FourUme.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace FourUme.Infrastructure.Feedback;

public class AdminFeedbackService(IAppDbContext db, ICurrentAdmin admin, FeedbackShared shared) : IAdminFeedbackService
{
    public async Task<AdminFeedbackPageDto> ListAsync(AdminFeedbackQuery query, CancellationToken ct = default)
    {
        await shared.CloseStaleAsync(ct);
        var q = db.FeedbackTickets.AsNoTracking().AsQueryable();
        if (query.Status == "unread") q = q.Where(t => t.AdminUnread);
        else if (query.Status == "active") q = q.Where(t => t.Status != FeedbackStatuses.Closed);
        else if (!string.IsNullOrWhiteSpace(query.Status)) q = q.Where(t => t.Status == query.Status);
        if (!string.IsNullOrWhiteSpace(query.Category)) q = q.Where(t => t.Category == query.Category);
        if (!string.IsNullOrWhiteSpace(query.Q))
        {
            var term = $"%{query.Q.Trim()}%";
            q = q.Where(t => EF.Functions.ILike(t.Subject, term)
                || EF.Functions.ILike(t.User.Email, term)
                || EF.Functions.ILike(t.User.DisplayName, term)
                || t.Messages.Any(m => EF.Functions.ILike(m.Body, term)));
        }

        var total = await q.CountAsync(ct);
        var page = Math.Max(1, query.Page);
        var size = Math.Clamp(query.PageSize, 1, 100);
        var rows = await q
            .OrderByDescending(t => t.AdminUnread)
            .ThenByDescending(t => t.LastMessageAt)
            .Skip((page - 1) * size)
            .Take(size)
            .Select(t => new
            {
                t.Id, t.Category, t.Subject, t.Status, t.AdminUnread, t.CreatedAt, t.LastMessageAt, t.WordId,
                Messages = t.Messages.Count,
                User = new AdminFeedbackUserDto(t.User.Id, t.User.Email, t.User.DisplayName),
            })
            .ToListAsync(ct);
        var wordIds = rows.Where(r => r.WordId != null).Select(r => r.WordId!).Distinct().ToList();
        var words = await db.Words.AsNoTracking().Where(w => wordIds.Contains(w.Id)).ToDictionaryAsync(w => w.Id, w => w.Text, ct);

        var items = rows.Select(r => new AdminFeedbackSummaryDto(
            r.Id, r.Category, r.Subject, r.Status, r.AdminUnread, r.CreatedAt, r.LastMessageAt, r.Messages, r.User,
            r.WordId is not null && words.TryGetValue(r.WordId, out var text) ? text : null)).ToList();
        return new AdminFeedbackPageDto(items, total, await CountsAsync(ct));
    }

    public async Task<AdminFeedbackCountsDto> CountsAsync(CancellationToken ct = default)
    {
        var byStatus = await db.FeedbackTickets.AsNoTracking()
            .GroupBy(t => t.Status)
            .Select(g => new { Status = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.Status, x => x.Count, ct);
        var unread = await db.FeedbackTickets.CountAsync(t => t.AdminUnread, ct);
        return new AdminFeedbackCountsDto(
            byStatus.GetValueOrDefault(FeedbackStatuses.Open),
            byStatus.GetValueOrDefault(FeedbackStatuses.Answered),
            byStatus.GetValueOrDefault(FeedbackStatuses.Closed),
            unread);
    }

    public async Task<AdminFeedbackTicketDto> GetAsync(Guid ticketId, CancellationToken ct = default)
    {
        await shared.CloseStaleAsync(ct);
        var ticket = await FindAsync(ticketId, ct);
        if (ticket.AdminUnread)
        {
            ticket.AdminUnread = false;
            await db.SaveChangesAsync(ct);
        }
        return await ToDtoAsync(ticket, ct);
    }

    public async Task<AdminFeedbackTicketDto> ReplyAsync(
        Guid ticketId, AdminFeedbackReplyRequest request, IReadOnlyList<FeedbackUpload> images, CancellationToken ct = default)
    {
        var body = FeedbackShared.CleanBody(request.Body);
        var ticket = await FindAsync(ticketId, ct);
        var message = new FeedbackMessage
        {
            TicketId = ticket.Id, FromAdmin = true, AuthorName = admin.Name, Body = body, Images = shared.SaveImages(images),
        };
        db.FeedbackMessages.Add(message);
        ticket.LastMessageAt = message.CreatedAt;
        ticket.AdminUnread = false;
        ticket.UserUnread = true;
        if (request.Close)
        {
            ticket.Status = FeedbackStatuses.Closed;
            ticket.ClosedAt = message.CreatedAt;
            ticket.ClosedBy = "admin";
        }
        else
        {
            ticket.Status = FeedbackStatuses.Answered;
            ticket.ClosedAt = null;
            ticket.ClosedBy = null;
        }
        await db.SaveChangesAsync(ct);
        return await ToDtoAsync(ticket, ct);
    }

    public async Task<AdminFeedbackTicketDto> SetClosedAsync(Guid ticketId, bool closed, CancellationToken ct = default)
    {
        var ticket = await FindAsync(ticketId, ct);
        if (closed && ticket.Status != FeedbackStatuses.Closed)
        {
            ticket.Status = FeedbackStatuses.Closed;
            ticket.ClosedAt = DateTimeOffset.UtcNow;
            ticket.ClosedBy = "admin";
        }
        else if (!closed && ticket.Status == FeedbackStatuses.Closed)
        {
            var lastFromAdmin = await db.FeedbackMessages.AsNoTracking()
                .Where(m => m.TicketId == ticket.Id)
                .OrderByDescending(m => m.CreatedAt)
                .Select(m => m.FromAdmin)
                .FirstOrDefaultAsync(ct);
            ticket.Status = lastFromAdmin ? FeedbackStatuses.Answered : FeedbackStatuses.Open;
            ticket.ClosedAt = null;
            ticket.ClosedBy = null;
            // Reopened answered tickets get a fresh auto-close window.
            ticket.LastMessageAt = lastFromAdmin ? DateTimeOffset.UtcNow : ticket.LastMessageAt;
        }
        await db.SaveChangesAsync(ct);
        return await ToDtoAsync(ticket, ct);
    }

    private async Task<FeedbackTicket> FindAsync(Guid ticketId, CancellationToken ct) =>
        await db.FeedbackTickets.Include(t => t.User).FirstOrDefaultAsync(t => t.Id == ticketId, ct)
            ?? throw new KeyNotFoundException();

    private async Task<AdminFeedbackTicketDto> ToDtoAsync(FeedbackTicket t, CancellationToken ct)
    {
        var messages = await db.FeedbackMessages.AsNoTracking()
            .Where(m => m.TicketId == t.Id)
            .OrderBy(m => m.CreatedAt)
            .ToListAsync(ct);
        return new AdminFeedbackTicketDto(t.Id, t.Category, t.Subject, t.Status, t.ClosedBy, t.CreatedAt, t.LastMessageAt,
            t.AppVersion, t.Platform, t.Device,
            new AdminFeedbackUserDto(t.User.Id, t.User.Email, t.User.DisplayName),
            await shared.WordAsync(t.WordId, ct),
            messages.Select(FeedbackShared.ToDto).ToList());
    }
}
