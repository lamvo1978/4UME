using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using FourUme.Application.Abstractions;
using FourUme.Application.Activity;
using FourUme.Application.Admin;
using FourUme.Application.Auth;
using FourUme.Domain.Entities;
using FourUme.Domain.Enums;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace FourUme.Infrastructure.Auth;

public class AuthService(
    IAppDbContext db,
    IOptions<JwtOptions> jwtOptions,
    PasswordHasher<User> passwordHasher,
    IActivityService activity) : IAuthService
{
    private readonly JwtOptions _jwt = jwtOptions.Value;

    public async Task<AuthResponse> RegisterAsync(RegisterRequest request, CancellationToken ct = default)
    {
        var email = request.Email.Trim().ToLowerInvariant();
        if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(request.Password) || request.Password.Length < 6)
        {
            throw new InvalidOperationException("Email và mật khẩu (tối thiểu 6 ký tự) là bắt buộc.");
        }

        if (await db.Users.AnyAsync(u => u.Email == email, ct))
        {
            throw new InvalidOperationException("Email đã được dùng.");
        }

        var user = new User
        {
            Email = email,
            DisplayName = string.IsNullOrWhiteSpace(request.DisplayName) ? email.Split('@')[0] : request.DisplayName.Trim()
        };
        user.PasswordHash = passwordHasher.HashPassword(user, request.Password);
        db.Users.Add(user);
        await db.SaveChangesAsync(ct);
        return CreateResponse(user);
    }

    public async Task<AuthResponse> LoginAsync(LoginRequest request, CancellationToken ct = default)
    {
        var email = request.Email.Trim().ToLowerInvariant();
        var user = await db.Users.FirstOrDefaultAsync(u => u.Email == email, ct)
            ?? throw new InvalidOperationException("Email hoặc mật khẩu không đúng.");

        var result = passwordHasher.VerifyHashedPassword(user, user.PasswordHash, request.Password);
        if (result == PasswordVerificationResult.Failed)
        {
            throw new InvalidOperationException("Email hoặc mật khẩu không đúng.");
        }
        if (user.LockedAt is not null)
        {
            throw new InvalidOperationException("Tài khoản đã bị khoá.");
        }

        return CreateResponse(user);
    }

    public async Task<MeResponse> GetMeAsync(Guid userId, CancellationToken ct = default)
    {
        var streak = await activity.GetStreakAsync(userId, ct);
        var user = await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId, ct)
            ?? throw new InvalidOperationException("Không tìm thấy người dùng.");

        var known = await db.WordProgresses.CountAsync(p => p.UserId == userId && p.Status == WordStatus.Known, ct);
        var hard = await db.WordProgresses.CountAsync(p => p.UserId == userId && p.Status == WordStatus.Hard, ct);
        var grammarPassed = await db.GrammarProgresses.CountAsync(p => p.UserId == userId && p.ReviewLevel > 0, ct);
        var grammarTotal = await db.GrammarLessons.CountAsync(l => l.Published, ct);

        return new MeResponse(
            user.Id, user.Email, user.DisplayName, known, hard, grammarPassed, grammarTotal,
            streak.Current, streak.StudiedToday, streak.TodayNewWords,
            streak.Freezes, streak.NextMilestone, streak.LastStudyDate,
            new UserSettingsDto(
                user.DailyGoal, user.SpeechRate, user.AutoSpeak, user.ReminderEnabled, user.ReminderTime,
                user.NotifyRescue, user.NotifyWeekly, user.NotifyNews, user.TimeZone));
    }

    public async Task<MeResponse> UpdateSettingsAsync(Guid userId, UpdateSettingsRequest request, CancellationToken ct = default)
    {
        var user = await FindUserAsync(userId, ct);

        if (request.DisplayName is not null)
        {
            var name = request.DisplayName.Trim();
            if (name.Length is < 1 or > 60) throw new InvalidOperationException("Tên hiển thị cần từ 1 đến 60 ký tự.");
            user.DisplayName = name;
        }
        if (request.DailyGoal is { } goal)
        {
            if (!UserSettingsRules.DailyGoals.Contains(goal)) throw new InvalidOperationException("Mục tiêu không hợp lệ.");
            user.DailyGoal = goal;
        }
        if (request.SpeechRate is { } rate)
        {
            user.SpeechRate = Math.Round(Math.Clamp(rate, UserSettingsRules.MinSpeechRate, UserSettingsRules.MaxSpeechRate), 2);
        }
        if (request.AutoSpeak is { } autoSpeak) user.AutoSpeak = autoSpeak;
        if (request.ReminderEnabled is { } reminder) user.ReminderEnabled = reminder;
        if (request.ReminderTime is not null)
        {
            if (!TimeOnly.TryParseExact(request.ReminderTime, "HH:mm", out var time))
                throw new InvalidOperationException("Giờ nhắc không hợp lệ.");
            user.ReminderTime = time.ToString("HH:mm");
        }
        if (request.NotifyRescue is { } rescue) user.NotifyRescue = rescue;
        if (request.NotifyWeekly is { } weekly) user.NotifyWeekly = weekly;
        if (request.NotifyNews is { } news) user.NotifyNews = news;
        if (request.TimeZone is not null)
        {
            var zone = request.TimeZone.Trim();
            if (zone.Length is 0 or > UserSettingsRules.MaxTimeZoneLength || !TimeZoneInfo.TryFindSystemTimeZoneById(zone, out _))
                throw new InvalidOperationException("Múi giờ không hợp lệ.");
            user.TimeZone = zone;
        }

        await db.SaveChangesAsync(ct);
        return await GetMeAsync(userId, ct);
    }

    public async Task ChangePasswordAsync(Guid userId, ChangePasswordRequest request, CancellationToken ct = default)
    {
        var user = await FindUserAsync(userId, ct);
        VerifyPassword(user, request.CurrentPassword, "Mật khẩu hiện tại không đúng.");
        if (string.IsNullOrEmpty(request.NewPassword) || request.NewPassword.Length < UserSettingsRules.MinPasswordLength)
        {
            throw new InvalidOperationException($"Mật khẩu mới cần tối thiểu {UserSettingsRules.MinPasswordLength} ký tự.");
        }

        user.PasswordHash = passwordHasher.HashPassword(user, request.NewPassword);
        await db.SaveChangesAsync(ct);
    }

    public async Task DeleteAccountAsync(Guid userId, DeleteAccountRequest request, CancellationToken ct = default)
    {
        var user = await FindUserAsync(userId, ct);
        VerifyPassword(user, request.Password, "Mật khẩu không đúng.");
        if (AdminUserRules.IsProtected(user.Email))
            throw new InvalidOperationException("Đây là tài khoản quản trị gốc, không thể xoá.");
        db.Users.Remove(user);
        await db.SaveChangesAsync(ct);
    }

    private async Task<User> FindUserAsync(Guid userId, CancellationToken ct) =>
        await db.Users.FirstOrDefaultAsync(u => u.Id == userId, ct)
            ?? throw new InvalidOperationException("Không tìm thấy người dùng.");

    private void VerifyPassword(User user, string? password, string error)
    {
        if (string.IsNullOrEmpty(password)
            || passwordHasher.VerifyHashedPassword(user, user.PasswordHash, password) == PasswordVerificationResult.Failed)
        {
            throw new InvalidOperationException(error);
        }
    }

    private AuthResponse CreateResponse(User user)
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_jwt.Key));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new Claim(JwtRegisteredClaimNames.Email, user.Email),
            new Claim("name", user.DisplayName)
        };
        var token = new JwtSecurityToken(
            issuer: _jwt.Issuer,
            audience: _jwt.Audience,
            claims: claims,
            expires: DateTime.UtcNow.AddMinutes(_jwt.ExpiryMinutes),
            signingCredentials: creds);
        var access = new JwtSecurityTokenHandler().WriteToken(token);
        return new AuthResponse(access, user.Id, user.Email, user.DisplayName);
    }
}
