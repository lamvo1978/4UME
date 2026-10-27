namespace FourUme.Application.Activity;

/// <summary>System-wide streak freeze rules (admin Cài đặt), stored in AppSettings under <see cref="SettingKey"/>.</summary>
public record StreakFreezeConfig
{
    public const string SettingKey = "streakFreeze";

    /// <summary>Free learners earn +1 when the streak is a multiple of this (7 → days 7, 14, …).</summary>
    public int FreezeEvery { get; init; } = StreakRules.FreezeEvery;

    /// <summary>Premium learners earn +1 on the first study session of each local calendar month.</summary>
    public bool PremiumMonthlyGrant { get; init; } = true;

    public int MaxFreezesFree { get; init; } = StreakRules.MaxFreezesFree;

    public int MaxFreezesPremium { get; init; } = StreakRules.MaxFreezesPremium;
}

public static class StreakFreezeRules
{
    public const int MinFreezeEvery = 1;
    public const int MaxFreezeEvery = 30;
    public const int MinCap = 0;
    public const int MaxCap = 10;

    public static List<string> Validate(StreakFreezeConfig c)
    {
        var problems = new List<string>();
        if (c.FreezeEvery is < MinFreezeEvery or > MaxFreezeEvery)
            problems.Add($"Chuỗi free: mốc nhận lượt phải từ {MinFreezeEvery} đến {MaxFreezeEvery} ngày.");
        if (c.MaxFreezesFree is < MinCap or > MaxCap)
            problems.Add($"Trần miễn phí phải từ {MinCap} đến {MaxCap} lượt.");
        if (c.MaxFreezesPremium is < MinCap or > MaxCap)
            problems.Add($"Trần Premium phải từ {MinCap} đến {MaxCap} lượt.");
        if (c.MaxFreezesPremium < c.MaxFreezesFree)
            problems.Add("Trần Premium không được nhỏ hơn trần miễn phí.");
        return problems;
    }
}

public interface IStreakFreezeSettings
{
    Task<StreakFreezeConfig> GetAsync(CancellationToken ct = default);
}
