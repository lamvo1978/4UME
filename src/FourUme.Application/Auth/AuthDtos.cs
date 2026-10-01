namespace FourUme.Application.Auth;

public record RegisterRequest(string Email, string Password, string DisplayName);
public record LoginRequest(string Email, string Password);
public record AuthResponse(string AccessToken, Guid UserId, string Email, string DisplayName);
public record MeResponse(
    Guid UserId,
    string Email,
    string DisplayName,
    int KnownWords,
    int HardWords,
    int GrammarLessonsCompleted);
