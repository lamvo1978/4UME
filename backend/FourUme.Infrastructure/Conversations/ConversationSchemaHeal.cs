using FourUme.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace FourUme.Infrastructure.Conversations;

/// <summary>Idempotent fixes when EF history says ConversationAddonQuota ran but columns are missing on prod.</summary>
public static class ConversationSchemaHeal
{
    public static async Task ApplyAsync(AppDbContext db, ILogger logger, CancellationToken ct = default)
    {
        await db.Database.ExecuteSqlRawAsync("""
            ALTER TABLE "Conversations" ADD COLUMN IF NOT EXISTS "SessionKind" character varying(16);
            ALTER TABLE "Users" ADD COLUMN IF NOT EXISTS "ConversationAddonUntil" timestamp with time zone;
            ALTER TABLE "Users" ADD COLUMN IF NOT EXISTS "StreakFreezeGrantMonth" integer;
            """, ct);
        logger.LogInformation("Conversation schema heal applied (SessionKind, ConversationAddonUntil).");
    }
}
