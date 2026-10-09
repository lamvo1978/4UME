using System.Collections.Concurrent;
using FourUme.Application.Abstractions;
using FourUme.Application.Admin;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace FourUme.Infrastructure.Auth;

/// <summary>
/// Singleton cache of "account exists and is not locked", so a lock or deletion takes effect on tokens
/// that were issued earlier. Entries live briefly; a lock made on this server invalidates its entry at once.
/// </summary>
public sealed class UserAccess(IServiceScopeFactory scopes) : IUserAccess
{
    private static readonly TimeSpan Lifetime = TimeSpan.FromSeconds(30);
    private readonly ConcurrentDictionary<Guid, (bool Active, DateTime Expires)> _cache = new();

    public async Task<bool> IsActiveAsync(Guid userId, CancellationToken ct = default)
    {
        if (_cache.TryGetValue(userId, out var hit) && hit.Expires > DateTime.UtcNow) return hit.Active;

        using var scope = scopes.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<IAppDbContext>();
        var active = await db.Users.AsNoTracking().AnyAsync(u => u.Id == userId && u.LockedAt == null, ct);
        _cache[userId] = (active, DateTime.UtcNow + Lifetime);
        return active;
    }

    public void Invalidate(Guid userId) => _cache.TryRemove(userId, out _);
}
