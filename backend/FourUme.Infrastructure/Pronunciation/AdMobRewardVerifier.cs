using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Logging;

namespace FourUme.Infrastructure.Pronunciation;

/// <summary>
/// Checks AdMob's server-side verification callbacks: the query string is signed (ECDSA P-256 / SHA-256)
/// with one of Google's published keys, so only real completed ad views can add checks.
/// </summary>
public class AdMobRewardVerifier(IHttpClientFactory http, ILogger<AdMobRewardVerifier> logger)
{
    public const string HttpClientName = "admob-keys";
    private const string KeysUrl = "https://www.gstatic.com/admob/reward/verifier-keys.json";
    private static readonly TimeSpan KeysLifetime = TimeSpan.FromHours(24);
    /// <summary>Unknown key ids trigger a refetch (Google rotates keys), but not more often than this.</summary>
    private static readonly TimeSpan RefetchGap = TimeSpan.FromMinutes(10);

    private readonly SemaphoreSlim gate = new(1, 1);
    private Dictionary<string, byte[]> keys = [];
    private DateTimeOffset fetchedAt = DateTimeOffset.MinValue;

    /// <param name="rawQuery">The query string as received, without the leading "?"; it must not be re-encoded.</param>
    public async Task<bool> VerifyAsync(string rawQuery, CancellationToken ct)
    {
        // Google signs everything before "&signature="; signature and key_id always come last.
        var cut = rawQuery.IndexOf("&signature=", StringComparison.Ordinal);
        if (cut <= 0) return false;
        var message = rawQuery[..cut];
        var tail = System.Web.HttpUtility.ParseQueryString(rawQuery[(cut + 1)..]);
        var signature = tail["signature"];
        var keyId = tail["key_id"];
        if (string.IsNullOrEmpty(signature) || string.IsNullOrEmpty(keyId)) return false;

        byte[] sig;
        try
        {
            sig = Base64UrlDecode(signature);
        }
        catch (FormatException)
        {
            return false;
        }

        var key = await GetKeyAsync(keyId, ct);
        if (key is null) return false;
        using var ecdsa = ECDsa.Create();
        ecdsa.ImportSubjectPublicKeyInfo(key, out _);
        return ecdsa.VerifyData(Encoding.UTF8.GetBytes(message), sig, HashAlgorithmName.SHA256, DSASignatureFormat.Rfc3279DerSequence);
    }

    private async Task<byte[]?> GetKeyAsync(string keyId, CancellationToken ct)
    {
        var age = DateTimeOffset.UtcNow - fetchedAt;
        if (age < KeysLifetime && keys.TryGetValue(keyId, out var cached)) return cached;
        if (age < RefetchGap) return keys.GetValueOrDefault(keyId);

        await gate.WaitAsync(ct);
        try
        {
            if (DateTimeOffset.UtcNow - fetchedAt >= RefetchGap)
            {
                try
                {
                    keys = await FetchKeysAsync(ct);
                    fetchedAt = DateTimeOffset.UtcNow;
                }
                catch (Exception ex) when (ex is HttpRequestException or JsonException or TaskCanceledException or FormatException)
                {
                    logger.LogWarning(ex, "Could not fetch AdMob verifier keys");
                }
            }
            return keys.GetValueOrDefault(keyId);
        }
        finally
        {
            gate.Release();
        }
    }

    private async Task<Dictionary<string, byte[]>> FetchKeysAsync(CancellationToken ct)
    {
        using var res = await http.CreateClient(HttpClientName).GetAsync(KeysUrl, ct);
        res.EnsureSuccessStatusCode();
        using var doc = JsonDocument.Parse(await res.Content.ReadAsStringAsync(ct));
        var result = new Dictionary<string, byte[]>();
        foreach (var k in doc.RootElement.GetProperty("keys").EnumerateArray())
        {
            var id = k.GetProperty("keyId").ToString();
            result[id] = Convert.FromBase64String(k.GetProperty("base64").GetString() ?? "");
        }
        return result;
    }

    private static byte[] Base64UrlDecode(string s)
    {
        var b64 = s.Replace('-', '+').Replace('_', '/');
        return Convert.FromBase64String(b64.PadRight(b64.Length + (4 - b64.Length % 4) % 4, '='));
    }
}
