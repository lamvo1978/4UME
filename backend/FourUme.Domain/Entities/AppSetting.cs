namespace FourUme.Domain.Entities;

/// <summary>System-wide parameter edited from the admin; the value is a JSON document per key.</summary>
public class AppSetting
{
    public string Key { get; set; } = string.Empty;
    public string Value { get; set; } = "{}";
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}
