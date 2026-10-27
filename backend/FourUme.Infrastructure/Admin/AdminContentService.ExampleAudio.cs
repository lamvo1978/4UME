using FourUme.Application.Admin;
using FourUme.Domain.Entities;
using FourUme.Infrastructure.Listening;
using FourUme.Infrastructure.Speech;
using Microsoft.EntityFrameworkCore;

namespace FourUme.Infrastructure.Admin;

public sealed partial class AdminContentService
{
    public async Task<ExampleAudioStatusDto> GetExampleAudioStatusAsync(CancellationToken ct = default)
    {
        var missing = await ExampleAudioMissingQuery().CountAsync(ct);
        var usage = await listeningJobs.GetUsageAsync(db, ct);
        var job = exampleAudioJobs.Current;
        return new ExampleAudioStatusDto(
            speech.Options.Configured,
            job?.Running ?? false,
            job?.Done ?? 0,
            job?.Total ?? 0,
            job?.Error,
            missing,
            usage.Chars,
            speech.Options.MonthlyCharLimit);
    }

    public async Task<ExampleAudioStatusDto> StartExampleAudioAsync(StartExampleAudioRequest? request, CancellationToken ct = default)
    {
        if (!speech.Options.Configured) throw new InvalidOperationException("Chưa cấu hình Azure Speech trên máy chủ.");

        var todo = await ExampleAudioMissingQuery()
            .OrderBy(w => w.DeckId).ThenBy(w => w.SortOrder).ThenBy(w => w.Id)
            .Select(w => new { w.Id, w.Example })
            .ToListAsync(ct);
        if (todo.Count == 0) throw new InvalidOperationException("Mọi câu ví dụ đang dùng đều có giọng đọc rồi.");

        var ranks = await ExampleVoiceRanksAsync(ct);
        var usage = await listeningJobs.GetUsageAsync(db, ct);
        var limit = speech.Options.MonthlyCharLimit;
        var cap = request?.MaxMonthPercent is int pct
            ? (int)Math.Floor(limit * (pct / 100.0))
            : limit;
        var budget = Math.Max(0, cap - usage.Chars);
        if (budget <= 0)
            throw new InvalidOperationException(
                $"Tháng này đã dùng {usage.Chars:N0}/{limit:N0} ký tự; không còn room trong giới hạn {(request?.MaxMonthPercent is int p ? $"{p}%" : "tháng")}.");

        var picked = new List<string>();
        var spent = 0;
        foreach (var row in todo)
        {
            var billed = AzureSpeechClient.BilledChars(row.Example);
            if (spent + billed > budget) break;
            picked.Add(row.Id);
            spent += billed;
        }

        if (picked.Count == 0)
            throw new InvalidOperationException(
                $"Ngân sách còn lại ~{budget:N0} ký tự; câu tiếp theo cần ~{AzureSpeechClient.BilledChars(todo[0].Example):N0}. Hãy đợi sang tháng hoặc tăng % cap.");

        exampleAudioJobs.Start(picked, ranks);
        auditor.Record(AuditEntities.Word, "example-audio", AuditActions.Generate, $"Tạo giọng đọc câu ví dụ cho {picked.Count} từ", null, null);
        await db.SaveChangesAsync(ct);
        return await GetExampleAudioStatusAsync(ct);
    }

    private IQueryable<Word> ExampleAudioMissingQuery() =>
        db.Words.AsNoTracking().Where(w =>
            w.Published
            && w.Example != ""
            && (w.ExampleAudioUrl == null || w.ExampleAudioText != w.Example));

    private async Task<IReadOnlyDictionary<string, int>> ExampleVoiceRanksAsync(CancellationToken ct)
    {
        var ordered = await db.Words.AsNoTracking()
            .Where(w => w.Published && w.Example != "")
            .OrderBy(w => w.DeckId).ThenBy(w => w.SortOrder).ThenBy(w => w.Id)
            .Select(w => w.Id)
            .ToListAsync(ct);
        return ordered.Select((id, i) => (id, i)).ToDictionary(x => x.id, x => x.i);
    }
}
