using FourUme.Application.Abstractions;
using FourUme.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace FourUme.Infrastructure.Persistence;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options), IAppDbContext
{
    public DbSet<User> Users => Set<User>();
    public DbSet<Word> Words => Set<Word>();
    public DbSet<WordProgress> WordProgresses => Set<WordProgress>();
    public DbSet<GrammarAttempt> GrammarAttempts => Set<GrammarAttempt>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<User>(e =>
        {
            e.HasKey(x => x.Id);
            e.HasIndex(x => x.Email).IsUnique();
            e.Property(x => x.Email).HasMaxLength(256).IsRequired();
            e.Property(x => x.DisplayName).HasMaxLength(120).IsRequired();
            e.Property(x => x.PasswordHash).IsRequired();
        });

        modelBuilder.Entity<Word>(e =>
        {
            e.HasKey(x => x.Id);
            e.HasIndex(x => x.DeckId);
            e.Property(x => x.Id).HasMaxLength(120);
            e.Property(x => x.DeckId).HasMaxLength(80).IsRequired();
            e.Property(x => x.Text).HasMaxLength(120).IsRequired();
            e.Property(x => x.Level).HasMaxLength(8).IsRequired();
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
    }
}
