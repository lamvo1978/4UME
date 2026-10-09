using FourUme.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace FourUme.Application.Abstractions;

public interface IAppDbContext
{
    DbSet<User> Users { get; }
    DbSet<Word> Words { get; }
    DbSet<Deck> Decks { get; }
    DbSet<MediaFile> MediaFiles { get; }
    DbSet<WordProgress> WordProgresses { get; }
    DbSet<GrammarAttempt> GrammarAttempts { get; }
    DbSet<GrammarLesson> GrammarLessons { get; }
    DbSet<GrammarProgress> GrammarProgresses { get; }
    DbSet<StudyDay> StudyDays { get; }
    DbSet<AppSetting> AppSettings { get; }
    DbSet<DeviceToken> DeviceTokens { get; }
    DbSet<NotificationLog> NotificationLogs { get; }
    DbSet<AuditLog> AuditLogs { get; }
    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}
