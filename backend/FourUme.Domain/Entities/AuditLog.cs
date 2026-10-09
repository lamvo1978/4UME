namespace FourUme.Domain.Entities;

/// <summary>One admin change to content. Before / After hold JSON snapshots so an old version can be restored.</summary>
public class AuditLog
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public DateTimeOffset At { get; set; } = DateTimeOffset.UtcNow;
    public Guid? UserId { get; set; }
    /// <summary>Copied at write time so the entry stays readable if the account is renamed or removed.</summary>
    public string UserName { get; set; } = string.Empty;
    /// <summary>See AuditEntities.</summary>
    public string EntityType { get; set; } = string.Empty;
    public string EntityId { get; set; } = string.Empty;
    /// <summary>See AuditActions.</summary>
    public string Action { get; set; } = string.Empty;
    /// <summary>Human label of the entity at that time (word text, deck or lesson title, file name).</summary>
    public string Summary { get; set; } = string.Empty;
    public string? Before { get; set; }
    public string? After { get; set; }
}

public static class AuditEntities
{
    public const string Word = "word";
    public const string Deck = "deck";
    public const string Grammar = "grammar";
    public const string Listening = "listening";
    public const string Media = "media";
    public const string User = "user";
    public const string Settings = "settings";
}

public static class AuditActions
{
    public const string Create = "create";
    public const string Update = "update";
    public const string Delete = "delete";
    public const string Restore = "restore";
    public const string Import = "import";
    public const string Reorder = "reorder";
    /// <summary>Generated media (e.g. listening audio); no snapshot.</summary>
    public const string Generate = "generate";
}
