namespace FourUme.Domain.Entities;

/// <summary>An image uploaded through the admin, stored under the media folder and served at <see cref="Url"/>.</summary>
public class MediaFile
{
    public Guid Id { get; set; } = Guid.NewGuid();
    /// <summary>Stored file name, e.g. "3f2a….webp".</summary>
    public string FileName { get; set; } = string.Empty;
    /// <summary>Public path, e.g. "/media/3f2a….webp".</summary>
    public string Url { get; set; } = string.Empty;
    public string OriginalName { get; set; } = string.Empty;
    public int Width { get; set; }
    public int Height { get; set; }
    public long Bytes { get; set; }
    public Guid? UploadedBy { get; set; }
    /// <summary>"pexels" or "pixabay" for stock photos; null for uploads.</summary>
    public string? Source { get; set; }
    /// <summary>Photo id at the source, so the same stock photo is downloaded only once.</summary>
    public string? SourceId { get; set; }
    /// <summary>Photo page at the source (credit link).</summary>
    public string? SourceUrl { get; set; }
    public string? Author { get; set; }
    public string? AuthorUrl { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
