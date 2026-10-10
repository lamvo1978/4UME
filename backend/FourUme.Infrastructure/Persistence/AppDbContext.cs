using FourUme.Application.Abstractions;
using FourUme.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace FourUme.Infrastructure.Persistence;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options), IAppDbContext
{
    public DbSet<User> Users => Set<User>();
    public DbSet<Word> Words => Set<Word>();
    public DbSet<Deck> Decks => Set<Deck>();
    public DbSet<MediaFile> MediaFiles => Set<MediaFile>();
    public DbSet<WordProgress> WordProgresses => Set<WordProgress>();
    public DbSet<GrammarAttempt> GrammarAttempts => Set<GrammarAttempt>();
    public DbSet<GrammarLesson> GrammarLessons => Set<GrammarLesson>();
    public DbSet<GrammarProgress> GrammarProgresses => Set<GrammarProgress>();
    public DbSet<ListeningLesson> ListeningLessons => Set<ListeningLesson>();
    public DbSet<ListeningProgress> ListeningProgresses => Set<ListeningProgress>();
    public DbSet<StudyDay> StudyDays => Set<StudyDay>();
    public DbSet<AppSetting> AppSettings => Set<AppSetting>();
    public DbSet<DeviceToken> DeviceTokens => Set<DeviceToken>();
    public DbSet<NotificationLog> NotificationLogs => Set<NotificationLog>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();
    public DbSet<EmailCode> EmailCodes => Set<EmailCode>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<User>(e =>
        {
            e.HasKey(x => x.Id);
            e.HasIndex(x => x.Email).IsUnique();
            e.Property(x => x.Email).HasMaxLength(256).IsRequired();
            e.Property(x => x.DisplayName).HasMaxLength(120).IsRequired();
            e.Property(x => x.PasswordHash).IsRequired();
            e.Property(x => x.ReminderTime).HasMaxLength(5).IsRequired();
            e.Property(x => x.TimeZone).HasMaxLength(64);
            e.Property(x => x.VocabLevel).HasMaxLength(2);
            e.Property(x => x.EasyWordMode).HasMaxLength(8).IsRequired().HasDefaultValue("skip");
            e.Property(x => x.Role).HasMaxLength(16).IsRequired().HasDefaultValue(UserRoles.User);
        });

        modelBuilder.Entity<EmailCode>(e =>
        {
            e.HasKey(x => x.Id);
            e.HasIndex(x => new { x.Email, x.Purpose }).IsUnique();
            e.Property(x => x.Email).HasMaxLength(256).IsRequired();
            e.Property(x => x.Purpose).HasMaxLength(32).IsRequired();
            e.Property(x => x.CodeHash).HasMaxLength(128).IsRequired();
        });

        modelBuilder.Entity<AppSetting>(e =>
        {
            e.HasKey(x => x.Key);
            e.Property(x => x.Key).HasMaxLength(64);
            e.Property(x => x.Value).HasColumnType("jsonb").IsRequired();
        });

        modelBuilder.Entity<DeviceToken>(e =>
        {
            e.HasKey(x => x.Id);
            e.HasIndex(x => x.Token).IsUnique();
            e.Property(x => x.Token).HasMaxLength(200).IsRequired();
            e.Property(x => x.Platform).HasMaxLength(16).IsRequired();
            e.Property(x => x.AppVersion).HasMaxLength(32);
            e.HasOne(x => x.User).WithMany(x => x.DeviceTokens).HasForeignKey(x => x.UserId);
        });

        modelBuilder.Entity<NotificationLog>(e =>
        {
            e.HasKey(x => x.Id);
            e.HasIndex(x => new { x.UserId, x.Kind, x.LocalDate }).IsUnique();
            e.Property(x => x.Kind).HasMaxLength(16).IsRequired();
            e.Property(x => x.Title).HasMaxLength(200).IsRequired();
            e.Property(x => x.Body).HasMaxLength(500).IsRequired();
            e.Property(x => x.Status).HasMaxLength(16).IsRequired();
            e.HasOne(x => x.User).WithMany(x => x.NotificationLogs).HasForeignKey(x => x.UserId);
        });

        modelBuilder.Entity<StudyDay>(e =>
        {
            e.HasKey(x => x.Id);
            e.HasIndex(x => new { x.UserId, x.Date }).IsUnique();
            e.HasOne(x => x.User).WithMany(x => x.StudyDays).HasForeignKey(x => x.UserId);
        });

        modelBuilder.Entity<Deck>(e =>
        {
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasMaxLength(80);
            e.Property(x => x.TitleVi).HasMaxLength(120).IsRequired();
            e.Property(x => x.Icon).HasMaxLength(64).IsRequired();
            e.Property(x => x.Published).HasDefaultValue(true);
            e.HasIndex(x => x.SortOrder);
        });

        modelBuilder.Entity<Word>(e =>
        {
            e.HasKey(x => x.Id);
            e.HasIndex(x => x.DeckId);
            e.Property(x => x.Id).HasMaxLength(120);
            e.Property(x => x.DeckId).HasMaxLength(80).IsRequired();
            e.Property(x => x.Text).HasMaxLength(120).IsRequired();
            e.Property(x => x.Level).HasMaxLength(8).IsRequired();
            e.Property(x => x.ImageUrl).HasMaxLength(500);
            e.HasIndex(x => x.ImagePending).HasFilter("\"ImagePending\"");
            e.Property(x => x.Published).HasDefaultValue(true);
            e.HasOne(x => x.Deck).WithMany(x => x.Words).HasForeignKey(x => x.DeckId).OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<MediaFile>(e =>
        {
            e.HasKey(x => x.Id);
            e.HasIndex(x => x.Url).IsUnique();
            e.Property(x => x.FileName).HasMaxLength(120).IsRequired();
            e.Property(x => x.Url).HasMaxLength(500).IsRequired();
            e.Property(x => x.OriginalName).HasMaxLength(255).IsRequired();
            e.Property(x => x.Source).HasMaxLength(16);
            e.Property(x => x.SourceId).HasMaxLength(40);
            e.Property(x => x.SourceUrl).HasMaxLength(500);
            e.Property(x => x.Author).HasMaxLength(120);
            e.Property(x => x.AuthorUrl).HasMaxLength(500);
            e.HasIndex(x => new { x.Source, x.SourceId });
        });

        modelBuilder.Entity<WordProgress>(e =>
        {
            e.HasKey(x => x.Id);
            e.HasIndex(x => new { x.UserId, x.WordId }).IsUnique();
            e.Property(x => x.WordId).HasMaxLength(120).IsRequired();
            e.HasOne(x => x.User).WithMany(x => x.WordProgresses).HasForeignKey(x => x.UserId);
        });

        modelBuilder.Entity<GrammarAttempt>(e =>
        {
            e.HasKey(x => x.Id);
            e.HasIndex(x => new { x.UserId, x.LessonSlug });
            e.Property(x => x.LessonSlug).HasMaxLength(80).IsRequired();
            e.HasOne(x => x.User).WithMany(x => x.GrammarAttempts).HasForeignKey(x => x.UserId);
        });

        modelBuilder.Entity<GrammarLesson>(e =>
        {
            e.HasKey(x => x.Slug);
            e.Property(x => x.Slug).HasMaxLength(80);
            e.Property(x => x.TitleVi).HasMaxLength(200).IsRequired();
            e.Property(x => x.TitleEn).HasMaxLength(200);
            e.Property(x => x.Level).HasMaxLength(8).IsRequired();
            e.Property(x => x.SectionsJson).HasColumnType("jsonb").IsRequired();
            e.Property(x => x.ExercisesJson).HasColumnType("jsonb").IsRequired();
            e.HasIndex(x => x.SortOrder);
        });

        modelBuilder.Entity<ListeningLesson>(e =>
        {
            e.HasKey(x => x.Slug);
            e.Property(x => x.Slug).HasMaxLength(80);
            e.Property(x => x.TitleEn).HasMaxLength(200).IsRequired();
            e.Property(x => x.TitleVi).HasMaxLength(200).IsRequired();
            e.Property(x => x.SummaryVi).HasMaxLength(1000).IsRequired();
            e.Property(x => x.Kind).HasMaxLength(16).IsRequired();
            e.Property(x => x.Level).HasMaxLength(8).IsRequired();
            e.Property(x => x.Topic).HasMaxLength(80);
            e.Property(x => x.SpeakersJson).HasColumnType("jsonb").IsRequired();
            e.Property(x => x.LinesJson).HasColumnType("jsonb").IsRequired();
            e.Property(x => x.AudioUrl).HasMaxLength(300);
            e.Property(x => x.AudioHash).HasMaxLength(64);
            e.Property(x => x.TimingsJson).HasColumnType("jsonb");
            e.HasIndex(x => x.SortOrder);
        });

        modelBuilder.Entity<ListeningProgress>(e =>
        {
            e.HasKey(x => x.Id);
            e.HasIndex(x => new { x.UserId, x.LessonSlug }).IsUnique();
            e.HasIndex(x => x.LessonSlug);
            e.Property(x => x.LessonSlug).HasMaxLength(80).IsRequired();
            e.HasOne(x => x.User).WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<AuditLog>(e =>
        {
            e.HasKey(x => x.Id);
            e.HasIndex(x => x.At);
            e.HasIndex(x => new { x.EntityType, x.EntityId, x.At });
            e.Property(x => x.UserName).HasMaxLength(256).IsRequired();
            e.Property(x => x.EntityType).HasMaxLength(16).IsRequired();
            e.Property(x => x.EntityId).HasMaxLength(120).IsRequired();
            e.Property(x => x.Action).HasMaxLength(16).IsRequired();
            e.Property(x => x.Summary).HasMaxLength(300).IsRequired();
            e.Property(x => x.Before).HasColumnType("jsonb");
            e.Property(x => x.After).HasColumnType("jsonb");
        });

        modelBuilder.Entity<GrammarProgress>(e =>
        {
            e.HasKey(x => x.Id);
            e.HasIndex(x => new { x.UserId, x.LessonSlug }).IsUnique();
            e.Property(x => x.LessonSlug).HasMaxLength(80).IsRequired();
            e.HasOne(x => x.User).WithMany(x => x.GrammarProgresses).HasForeignKey(x => x.UserId);
        });
    }
}
