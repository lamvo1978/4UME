using System.Security.Cryptography;
using System.Text;
using FourUme.Application.Abstractions;
using FourUme.Application.Auth;
using FourUme.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace FourUme.Infrastructure.Auth;

/// <summary>Issues and checks the 6-digit codes mailed for sign-up and password reset.</summary>
public class EmailCodeService(IAppDbContext db, IEmailSender email, IOptions<JwtOptions> jwtOptions)
{
    private readonly byte[] _hashKey = Encoding.UTF8.GetBytes(jwtOptions.Value.Key);

    public async Task<SendCodeResponse> SendAsync(string address, string purpose, CancellationToken ct)
    {
        var now = DateTimeOffset.UtcNow;
        var entry = await db.EmailCodes.FirstOrDefaultAsync(c => c.Email == address && c.Purpose == purpose, ct);
        if (entry is null)
        {
            entry = new EmailCode { Email = address, Purpose = purpose, WindowStartedAt = now };
            db.EmailCodes.Add(entry);
        }
        else
        {
            var wait = entry.CreatedAt + EmailCodeRules.ResendAfter - now;
            if (wait > TimeSpan.Zero)
                throw new InvalidOperationException($"Vui lòng đợi {Math.Ceiling(wait.TotalSeconds)} giây rồi gửi lại mã.");
            if (now - entry.WindowStartedAt >= EmailCodeRules.SendWindow)
            {
                entry.WindowStartedAt = now;
                entry.SentInWindow = 0;
            }
            if (entry.SentInWindow >= EmailCodeRules.MaxSendsPerWindow)
                throw new InvalidOperationException("Đã gửi mã quá nhiều lần. Vui lòng thử lại sau một giờ.");
        }

        var code = RandomNumberGenerator.GetInt32(0, 1_000_000).ToString("D6");
        entry.CodeHash = Hash(address, purpose, code);
        entry.CreatedAt = now;
        entry.ExpiresAt = now + EmailCodeRules.Lifetime;
        entry.FailedAttempts = 0;
        entry.SentInWindow++;

        await email.SendAsync(Compose(address, purpose, code), ct);
        await db.SaveChangesAsync(ct);
        return new SendCodeResponse((int)EmailCodeRules.ResendAfter.TotalSeconds, (int)EmailCodeRules.Lifetime.TotalMinutes);
    }

    /// <summary>
    /// Marks the code used on success; the caller saves it together with the action it unlocks.
    /// A wrong code is counted and saved here before throwing.
    /// </summary>
    public async Task ConsumeAsync(string address, string purpose, string? code, CancellationToken ct)
    {
        var entry = await db.EmailCodes.FirstOrDefaultAsync(c => c.Email == address && c.Purpose == purpose, ct);
        if (entry is null || entry.CodeHash.Length == 0 || entry.ExpiresAt <= DateTimeOffset.UtcNow)
            throw new InvalidOperationException("Mã đã hết hạn hoặc chưa được gửi. Vui lòng gửi lại mã.");
        if (entry.FailedAttempts >= EmailCodeRules.MaxAttempts)
            throw new InvalidOperationException("Nhập sai quá nhiều lần. Vui lòng gửi lại mã mới.");

        var given = Hash(address, purpose, (code ?? "").Trim());
        if (!CryptographicOperations.FixedTimeEquals(Encoding.ASCII.GetBytes(given), Encoding.ASCII.GetBytes(entry.CodeHash)))
        {
            entry.FailedAttempts++;
            await db.SaveChangesAsync(ct);
            var left = EmailCodeRules.MaxAttempts - entry.FailedAttempts;
            throw new InvalidOperationException(left > 0
                ? $"Mã không đúng. Bạn còn {left} lần thử."
                : "Nhập sai quá nhiều lần. Vui lòng gửi lại mã mới.");
        }

        entry.CodeHash = "";
    }

    private string Hash(string address, string purpose, string code) =>
        Convert.ToHexString(HMACSHA256.HashData(_hashKey, Encoding.UTF8.GetBytes($"{purpose}:{address}:{code}")));

    private static EmailMessage Compose(string address, string purpose, string code)
    {
        var (kind, intro) = purpose == EmailCodePurposes.Register
            ? ("xác nhận tạo tài khoản", "Dùng mã dưới đây để hoàn tất tạo tài khoản 4UME của bạn.")
            : ("đặt lại mật khẩu", "Dùng mã dưới đây để đặt lại mật khẩu tài khoản 4UME của bạn.");
        var minutes = (int)EmailCodeRules.Lifetime.TotalMinutes;
        var footer = "Nếu bạn không yêu cầu, hãy bỏ qua email này — tài khoản của bạn vẫn an toàn.";

        var html = $"""
            <div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#1f2a24">
              <div style="font-size:22px;font-weight:700;color:#2f5d50;margin-bottom:16px">4UME</div>
              <p style="font-size:15px;line-height:1.5;margin:0 0 16px">{intro}</p>
              <div style="font-size:32px;font-weight:700;letter-spacing:8px;background:#eef4f1;border-radius:12px;padding:16px;text-align:center">{code}</div>
              <p style="font-size:14px;color:#5b6b63;margin:16px 0 0">Mã có hiệu lực trong {minutes} phút. Đừng chia sẻ mã này với ai.</p>
              <p style="font-size:13px;color:#8a978f;margin:24px 0 0">{footer}</p>
            </div>
            """;
        var text = $"{intro}\n\nMã của bạn: {code}\n\nMã có hiệu lực trong {minutes} phút. Đừng chia sẻ mã này với ai.\n\n{footer}";
        return new EmailMessage(address, $"{code} là mã {kind} 4UME", html, text);
    }
}
