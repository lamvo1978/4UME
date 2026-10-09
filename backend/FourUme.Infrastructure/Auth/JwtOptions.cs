namespace FourUme.Infrastructure.Auth;

public class JwtOptions
{
    public const string SectionName = "Jwt";
    public string Issuer { get; set; } = "4UME";
    public string Audience { get; set; } = "4UME";
    public string Key { get; set; } = "CHANGE_ME_TO_A_LONG_RANDOM_SECRET_KEY_32+";
    public int ExpiryMinutes { get; set; } = 60 * 24 * 7;
}
