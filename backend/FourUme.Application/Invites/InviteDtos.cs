using System.Security.Cryptography;

namespace FourUme.Application.Invites;

/// <summary>Hidden features a partner can unlock for its students.</summary>
public static class FeatureKeys
{
    public const string Ielts = "ielts";
    public static readonly IReadOnlyList<string> All = [Ielts];

    public static IReadOnlyList<string> Parse(string? csv) =>
        (csv ?? "").Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Where(All.Contains).Distinct().ToList();

    /// <summary>Keeps only known keys; throws for unknown ones so typos never silently unlock nothing.</summary>
    public static string Join(IEnumerable<string>? keys)
    {
        var list = (keys ?? []).Select(k => k.Trim().ToLowerInvariant()).Where(k => k.Length > 0).Distinct().ToList();
        if (list.FirstOrDefault(k => !All.Contains(k)) is { } unknown) throw new InvalidOperationException($"Tính năng không hợp lệ: {unknown}.");
        return string.Join(',', list);
    }
}

/// <summary>Invite-a-friend options (admin "Cài đặt"), stored in AppSettings under <see cref="SettingKey"/>.</summary>
public record ReferralConfig
{
    public const string SettingKey = "referral";

    public bool Enabled { get; init; } = true;
    /// <summary>Study days the invitee needs before both sides are rewarded.</summary>
    public int RequiredStudyDays { get; init; } = 3;
    /// <summary>Premium days each side receives.</summary>
    public int RewardDays { get; init; } = 7;
    /// <summary>Rewards one inviter can earn in total; invitees past the cap are still rewarded themselves.</summary>
    public int MaxRewardsPerUser { get; init; } = 10;
    /// <summary>An invite code is accepted only this many days after the invitee's account was created.</summary>
    public int JoinWindowDays { get; init; } = 14;
}

public static class ReferralRules
{
    public const string InviteUrl = "https://4ume.io.vn/moi/?ma=";
    public const int ReferralCodeLength = 6;
    public const int PartnerCodeLength = 8;
    public const int MaxBatchSize = 500;
    /// <summary>No 0/O, 1/I/L, so codes read aloud or copied from paper survive.</summary>
    private const string Alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

    public static IReadOnlyList<string> Validate(ReferralConfig c)
    {
        var problems = new List<string>();
        if (c.RequiredStudyDays is < 1 or > 30) problems.Add("Số ngày học cần đạt phải từ 1 đến 30.");
        if (c.RewardDays is < 1 or > 365) problems.Add("Số ngày Premium thưởng phải từ 1 đến 365.");
        if (c.MaxRewardsPerUser is < 0 or > 1000) problems.Add("Số lần thưởng tối đa phải từ 0 đến 1000.");
        if (c.JoinWindowDays is < 1 or > 365) problems.Add("Hạn nhập mã mời phải từ 1 đến 365 ngày.");
        return problems;
    }

    public static string NewCode(int length) =>
        string.Create(length, 0, (span, _) =>
        {
            for (var i = 0; i < span.Length; i++) span[i] = Alphabet[RandomNumberGenerator.GetInt32(Alphabet.Length)];
        });

    /// <summary>Upper-cases and drops spaces and dashes, so "abcd-1234" and "ABCD1234" match.</summary>
    public static string Normalize(string? code) =>
        new((code ?? "").ToUpperInvariant().Where(char.IsLetterOrDigit).ToArray());

    public static string FormatPartnerCode(string code) => code.Length == PartnerCodeLength ? $"{code[..4]}-{code[4..]}" : code;
}

/// <summary>What the learner currently has: Premium from any source plus partner features.</summary>
/// <param name="PremiumUntil">End of time-limited Premium (admin or invite rewards); partner Premium has no end.</param>
/// <param name="PartnerName">Set while the learner is an active partner student.</param>
public record AccessDto(bool Premium, DateTimeOffset? PremiumUntil, string? PartnerName, IReadOnlyList<string> Features);

/// <param name="DisplayName">The invited friend's display name.</param>
/// <param name="StudyDays">Days studied so far (capped at the requirement).</param>
public record InviteeDto(string DisplayName, DateTimeOffset JoinedAt, int StudyDays, DateTimeOffset? RewardedAt);

/// <param name="CanEnterInviteCode">The account is new enough and hasn't used an invite code yet.</param>
/// <param name="InvitedBy">Display name of whoever invited this learner.</param>
public record MyReferralDto(
    bool Enabled,
    string Code,
    string Link,
    int RequiredStudyDays,
    int RewardDays,
    int MaxRewards,
    int RewardsEarned,
    bool CanEnterInviteCode,
    string? InvitedBy,
    IReadOnlyList<InviteeDto> Invitees,
    int JoinWindowDays);

public record RedeemCodeRequest(string? Code);

/// <param name="Kind">"partner" or "referral".</param>
public record RedeemResultDto(string Kind, string Message);

public interface IReferralService
{
    Task<ReferralConfig> GetConfigAsync(CancellationToken ct = default);
    Task<MyReferralDto> GetMineAsync(Guid userId, CancellationToken ct = default);
    /// <summary>Applies an invite or partner code; throws InvalidOperationException with a message for the learner.</summary>
    Task<RedeemResultDto> RedeemAsync(Guid userId, string? code, CancellationToken ct = default);
    /// <summary>Called on the learner's first activity of a day; rewards the invite once enough days are studied.</summary>
    Task OnStudyDayAsync(Guid userId, CancellationToken ct = default);
}
