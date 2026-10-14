namespace FourUme.Application.Speech;

public static class WordVoices
{
    public const string Female = "female";
    public const string Male = "male";

    public static readonly IReadOnlyDictionary<string, string> Azure = new Dictionary<string, string>
    {
        [Female] = "en-US-JennyNeural",
        [Male] = "en-US-GuyNeural",
    };

    /// <summary>Words stop getting new recordings past this share of the monthly characters, leaving room for lesson audio made in the admin.</summary>
    public const double MonthlyShare = 0.9;
}

/// <param name="Url">Null when there is no recording and none can be made now (quota spent, Azure off, unknown word); the app uses the phone's voice.</param>
public record WordAudioDto(string? Url);

public interface IWordAudioService
{
    /// <summary>The recording of a vocabulary word, made with Azure the first time it is asked for.</summary>
    Task<WordAudioDto> GetAsync(string text, string voice, CancellationToken ct = default);
}
