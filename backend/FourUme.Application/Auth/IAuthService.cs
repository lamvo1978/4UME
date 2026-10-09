namespace FourUme.Application.Auth;

public interface IAuthService
{
    Task<SendCodeResponse> SendRegisterCodeAsync(SendCodeRequest request, CancellationToken ct = default);
    Task<SendCodeResponse> SendResetCodeAsync(SendCodeRequest request, CancellationToken ct = default);
    Task<AuthResponse> ResetPasswordAsync(ResetPasswordRequest request, CancellationToken ct = default);
    Task<AuthResponse> RegisterAsync(RegisterRequest request, CancellationToken ct = default);
    Task<AuthResponse> LoginAsync(LoginRequest request, CancellationToken ct = default);
    Task<MeResponse> GetMeAsync(Guid userId, CancellationToken ct = default);
    Task<MeResponse> UpdateSettingsAsync(Guid userId, UpdateSettingsRequest request, CancellationToken ct = default);
    Task ChangePasswordAsync(Guid userId, ChangePasswordRequest request, CancellationToken ct = default);
    Task DeleteAccountAsync(Guid userId, DeleteAccountRequest request, CancellationToken ct = default);
}
