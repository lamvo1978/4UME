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
    DbSet<ListeningLesson> ListeningLessons { get; }
    DbSet<ListeningProgress> ListeningProgresses { get; }
    DbSet<StudyDay> StudyDays { get; }
    DbSet<AppSetting> AppSettings { get; }
    DbSet<DeviceToken> DeviceTokens { get; }
    DbSet<NotificationLog> NotificationLogs { get; }
    DbSet<AuditLog> AuditLogs { get; }
    DbSet<EmailCode> EmailCodes { get; }
    DbSet<PronunciationAttempt> PronunciationAttempts { get; }
    DbSet<AdReward> AdRewards { get; }
    DbSet<ListeningLog> ListeningLogs { get; }
    DbSet<Partner> Partners { get; }
    DbSet<PartnerCode> PartnerCodes { get; }
    DbSet<Referral> Referrals { get; }
    DbSet<FeedbackTicket> FeedbackTickets { get; }
    DbSet<FeedbackMessage> FeedbackMessages { get; }
    DbSet<Broadcast> Broadcasts { get; }
    DbSet<BroadcastRecipient> BroadcastRecipients { get; }
    DbSet<PlacementGrammarQuestion> PlacementGrammarQuestions { get; }
    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}
