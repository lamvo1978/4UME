using SkiaSharp;

namespace FourUme.Infrastructure.Media;

public class MediaOptions
{
    public const string SectionName = "Media";
    /// <summary>Folder for uploaded files; served by the API at <see cref="UrlPrefix"/>.</summary>
    public string Path { get; set; } = "media";
    public const string UrlPrefix = "/media";
    public const int MaxSide = 800;
    public const int MaxUploadBytes = 15 * 1024 * 1024;
}

public record StoredImage(string FileName, string Url, int Width, int Height, long Bytes);

/// <summary>Normalizes uploads (EXIF rotation, optional centre square crop, ≤ 800px) and saves them as WebP.</summary>
public static class MediaStorage
{
    private const int WebpQuality = 82;

    /// <param name="folder">Media root.</param>
    /// <param name="subfolder">Optional folder under the root, part of the public URL.</param>
    public static StoredImage SaveImage(Stream input, string folder, bool squareCrop, int maxSide = MediaOptions.MaxSide, string? subfolder = null)
    {
        using var buffer = new MemoryStream();
        input.CopyTo(buffer);
        if (buffer.Length > MediaOptions.MaxUploadBytes) throw new InvalidOperationException("Ảnh quá lớn (tối đa 15 MB).");
        buffer.Position = 0;

        using var codec = SKCodec.Create(buffer) ?? throw new InvalidOperationException("Không đọc được ảnh. Hãy dùng JPG, PNG hoặc WebP.");
        using var decoded = SKBitmap.Decode(codec) ?? throw new InvalidOperationException("Không đọc được ảnh.");
        using var upright = ApplyOrientation(decoded, codec.EncodedOrigin);

        var crop = squareCrop ? CentreSquare(upright.Width, upright.Height) : new SKRectI(0, 0, upright.Width, upright.Height);
        var scale = Math.Min(1f, (float)maxSide / Math.Max(crop.Width, crop.Height));
        var width = Math.Max(1, (int)Math.Round(crop.Width * scale));
        var height = Math.Max(1, (int)Math.Round(crop.Height * scale));

        using var surface = SKSurface.Create(new SKImageInfo(width, height, SKColorType.Rgba8888, SKAlphaType.Premul));
        using (var image = SKImage.FromBitmap(upright))
        {
            surface.Canvas.Clear(SKColors.Transparent);
            surface.Canvas.DrawImage(image, crop, new SKRect(0, 0, width, height), new SKSamplingOptions(SKCubicResampler.Mitchell));
        }
        using var snapshot = surface.Snapshot();
        using var data = snapshot.Encode(SKEncodedImageFormat.Webp, WebpQuality)
            ?? throw new InvalidOperationException("Không nén được ảnh.");

        var target = subfolder is null ? folder : System.IO.Path.Combine(folder, subfolder);
        Directory.CreateDirectory(target);
        var fileName = $"{Guid.NewGuid():N}.webp";
        using (var file = File.Create(System.IO.Path.Combine(target, fileName)))
        {
            data.SaveTo(file);
        }
        var url = subfolder is null ? $"{MediaOptions.UrlPrefix}/{fileName}" : $"{MediaOptions.UrlPrefix}/{subfolder}/{fileName}";
        return new StoredImage(fileName, url, width, height, data.Size);
    }

    public static void Delete(string folder, string fileName)
    {
        var path = System.IO.Path.Combine(folder, System.IO.Path.GetFileName(fileName));
        if (File.Exists(path)) File.Delete(path);
    }

    private static SKRectI CentreSquare(int w, int h)
    {
        var side = Math.Min(w, h);
        return SKRectI.Create((w - side) / 2, (h - side) / 2, side, side);
    }

    /// <summary>Phone photos store rotation in EXIF; bake it in so the image displays upright everywhere.</summary>
    private static SKBitmap ApplyOrientation(SKBitmap src, SKEncodedOrigin origin)
    {
        var (degrees, swap) = origin switch
        {
            SKEncodedOrigin.RightTop => (90, true),
            SKEncodedOrigin.BottomRight => (180, false),
            SKEncodedOrigin.LeftBottom => (270, true),
            _ => (0, false),
        };
        if (degrees == 0) return src.Copy();

        var rotated = new SKBitmap(swap ? src.Height : src.Width, swap ? src.Width : src.Height);
        using var canvas = new SKCanvas(rotated);
        canvas.Translate(rotated.Width / 2f, rotated.Height / 2f);
        canvas.RotateDegrees(degrees);
        canvas.Translate(-src.Width / 2f, -src.Height / 2f);
        canvas.DrawBitmap(src, 0, 0);
        return rotated;
    }
}
