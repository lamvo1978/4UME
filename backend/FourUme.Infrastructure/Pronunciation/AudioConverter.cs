using System.Diagnostics;
using FourUme.Application.Pronunciation;

namespace FourUme.Infrastructure.Pronunciation;

/// <summary>
/// Turns whatever the phone recorded (iOS WAV, Android AAC/M4A, browser WebM) into the 16 kHz mono 16-bit WAV
/// that Azure's short-audio API accepts. Needs the ffmpeg binary (installed in the API image).
/// </summary>
public static class AudioConverter
{
    public const int SampleRate = 16000;
    private const int WavHeaderBytes = 44;
    private static readonly TimeSpan Timeout = TimeSpan.FromSeconds(15);

    public static async Task<(byte[] Wav, int DurationMs)> ToWav16kAsync(byte[] input, CancellationToken ct)
    {
        var inPath = Path.Combine(Path.GetTempPath(), $"pron-{Guid.NewGuid():N}");
        await File.WriteAllBytesAsync(inPath, input, ct);
        try
        {
            var psi = new ProcessStartInfo("ffmpeg")
            {
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                UseShellExecute = false,
            };
            foreach (var arg in new[]
            {
                "-hide_banner", "-loglevel", "error", "-i", inPath, "-t", PronunciationRules.MaxAudioSeconds.ToString(),
                "-ac", "1", "-ar", SampleRate.ToString(), "-acodec", "pcm_s16le", "-f", "wav", "pipe:1",
            }) psi.ArgumentList.Add(arg);

            Process process;
            try
            {
                process = Process.Start(psi) ?? throw new InvalidOperationException();
            }
            catch (Exception)
            {
                throw new PronunciationException(503, "Máy chủ chưa cài ffmpeg nên chưa chấm được phát âm.");
            }

            using (process)
            {
                using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct);
                timeout.CancelAfter(Timeout);
                using var output = new MemoryStream();
                var copy = process.StandardOutput.BaseStream.CopyToAsync(output, timeout.Token);
                var errors = process.StandardError.ReadToEndAsync(timeout.Token);
                try
                {
                    await Task.WhenAll(copy, errors, process.WaitForExitAsync(timeout.Token));
                }
                catch (OperationCanceledException) when (!ct.IsCancellationRequested)
                {
                    process.Kill(true);
                    throw new PronunciationException(400, "Không xử lý được bản ghi âm.");
                }

                if (process.ExitCode != 0 || output.Length <= WavHeaderBytes)
                {
                    throw new PronunciationException(400, "Không đọc được bản ghi âm, hãy thử ghi lại.");
                }
                var wav = output.ToArray();
                var durationMs = (int)((wav.Length - WavHeaderBytes) * 1000L / (SampleRate * 2));
                return (wav, durationMs);
            }
        }
        finally
        {
            File.Delete(inPath);
        }
    }
}
