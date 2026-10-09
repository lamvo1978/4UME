using FourUme.Application.Activity;

namespace FourUme.Api;

/// <summary>Reads the client's UTC offset in minutes from the X-Utc-Offset header (e.g. 420 for UTC+7).</summary>
public sealed class HttpClientClock(IHttpContextAccessor accessor) : IClientClock
{
    public const string Header = "X-Utc-Offset";
    private const int DefaultOffsetMinutes = 7 * 60;
    private const int MaxOffsetMinutes = 14 * 60;

    public TimeSpan Offset
    {
        get
        {
            var raw = accessor.HttpContext?.Request.Headers[Header].ToString();
            var minutes = int.TryParse(raw, out var parsed) && Math.Abs(parsed) <= MaxOffsetMinutes
                ? parsed
                : DefaultOffsetMinutes;
            return TimeSpan.FromMinutes(minutes);
        }
    }

    public DateOnly Today => DateOnly.FromDateTime(DateTime.UtcNow + Offset);
}
