using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using FourUme.Application.Abstractions;
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
    PasswordHasher<User> passwordHasher) : IAuthService
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

        return CreateResponse(user);
    }

    public async Task<MeResponse> GetMeAsync(Guid userId, CancellationToken ct = default)
    {
        var user = await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId, ct)
            ?? throw new InvalidOperationException("Không tìm thấy người dùng.");

        var known = await db.WordProgresses.CountAsync(p => p.UserId == userId && p.Status == WordStatus.Known, ct);
        var hard = await db.WordProgresses.CountAsync(p => p.UserId == userId && p.Status == WordStatus.Hard, ct);
        var grammarDone = await db.GrammarAttempts
            .Where(a => a.UserId == userId)
            .Select(a => a.LessonSlug)
            .Distinct()
            .CountAsync(ct);

        return new MeResponse(user.Id, user.Email, user.DisplayName, known, hard, grammarDone);
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
