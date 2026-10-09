namespace FourUme.Infrastructure.Listening;

/// <summary>
/// Minimal MPEG audio frame walker, enough to join MP3 clips: it drops ID3 tags and Xing/Info/VBRI header frames
/// (which would make players report only the first clip's length) and measures the duration from the frames.
/// </summary>
public static class Mp3Frames
{
    private static readonly int[] BitratesV1 = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320];
    private static readonly int[] BitratesV2 = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160];

    public static (byte[] Audio, int DurationMs) Clean(byte[] data)
    {
        using var output = new MemoryStream(data.Length);
        double ms = 0;
        var i = SkipId3(data, 0);

        while (i + 4 <= data.Length)
        {
            if (!TryReadHeader(data, i, out var length, out var samples, out var sampleRate) || i + length > data.Length)
            {
                i++;
                continue;
            }
            if (!IsInfoFrame(data, i, length))
            {
                output.Write(data, i, length);
                ms += samples * 1000.0 / sampleRate;
            }
            i += length;
            if (i + 3 <= data.Length && data[i] == 'I' && data[i + 1] == 'D' && data[i + 2] == '3') i = SkipId3(data, i);
        }
        return (output.ToArray(), (int)Math.Round(ms));
    }

    private static int SkipId3(byte[] d, int i)
    {
        if (i + 10 > d.Length || d[i] != 'I' || d[i + 1] != 'D' || d[i + 2] != '3') return i;
        var size = (d[i + 6] & 0x7F) << 21 | (d[i + 7] & 0x7F) << 14 | (d[i + 8] & 0x7F) << 7 | (d[i + 9] & 0x7F);
        return i + 10 + size;
    }

    private static bool TryReadHeader(byte[] d, int i, out int length, out int samples, out int sampleRate)
    {
        length = samples = sampleRate = 0;
        if (d[i] != 0xFF || (d[i + 1] & 0xE0) != 0xE0) return false;
        var version = (d[i + 1] >> 3) & 3; // 3 = MPEG-1, 2 = MPEG-2, 0 = MPEG-2.5
        var layer = (d[i + 1] >> 1) & 3; // 1 = Layer III
        var bitrateIndex = (d[i + 2] >> 4) & 0xF;
        var rateIndex = (d[i + 2] >> 2) & 3;
        var padding = (d[i + 2] >> 1) & 1;
        if (version == 1 || layer != 1 || bitrateIndex is 0 or 15 || rateIndex == 3) return false;

        var v1 = version == 3;
        var bitrate = (v1 ? BitratesV1 : BitratesV2)[bitrateIndex] * 1000;
        sampleRate = (v1 ? new[] { 44100, 48000, 32000 } : new[] { 22050, 24000, 16000 })[rateIndex];
        if (version == 0) sampleRate /= 2;
        samples = v1 ? 1152 : 576;
        length = (v1 ? 144 : 72) * bitrate / sampleRate + padding;
        return length > 4;
    }

    private static bool IsInfoFrame(byte[] d, int start, int length)
    {
        var end = Math.Min(start + Math.Min(length, 48), d.Length) - 4;
        for (var j = start + 4; j <= end; j++)
        {
            if ((d[j] == 'X' && d[j + 1] == 'i' && d[j + 2] == 'n' && d[j + 3] == 'g')
                || (d[j] == 'I' && d[j + 1] == 'n' && d[j + 2] == 'f' && d[j + 3] == 'o')
                || (d[j] == 'V' && d[j + 1] == 'B' && d[j + 2] == 'R' && d[j + 3] == 'I'))
                return true;
        }
        return false;
    }
}
