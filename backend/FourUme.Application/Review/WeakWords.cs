using FourUme.Domain.Entities;

namespace FourUme.Application.Review;

/// <summary>
/// "Ôn từ hay sai": a word is weak while its <see cref="WordProgress.WeakScore"/> is above 0, or while its latest
/// pronunciation score is below <see cref="SpeakThreshold"/>. One mistake needs two clean answers to clear.
/// </summary>
public static class WeakWords
{
    public const int MistakePoints = 2;
    /// <summary>Caps how long a word that was missed many times stays listed once it is answered well.</summary>
    public const int MaxScore = 6;
    public const int SpeakThreshold = 70;

    public static void Apply(WordProgress progress, int mistakes) =>
        progress.WeakScore = mistakes > 0
            ? Math.Min(progress.WeakScore + MistakePoints, MaxScore)
            : Math.Max(progress.WeakScore - 1, 0);
}
