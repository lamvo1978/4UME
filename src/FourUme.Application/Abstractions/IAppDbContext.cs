using FourUme.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace FourUme.Application.Abstractions;

public interface IAppDbContext
{
    DbSet<User> Users { get; }
    DbSet<Word> Words { get; }
    DbSet<WordProgress> WordProgresses { get; }
    DbSet<GrammarAttempt> GrammarAttempts { get; }
    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}
