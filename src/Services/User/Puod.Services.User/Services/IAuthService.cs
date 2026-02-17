using Puod.Services.User.DTOs;

namespace Puod.Services.User.Services;

public interface IAuthService
{
    Task<LoginResponse> RegisterAsync(RegisterRequest request, CancellationToken ct = default);
    Task<LoginResponse> LoginAsync(LoginRequest request, CancellationToken ct = default);
    Task<DiscoveryResponse> DiscoverAsync(string email, CancellationToken ct = default);
    Task<LoginResponse> CallbackAsync(CallbackRequest request, CancellationToken ct = default);
    Task<LoginResponse> RefreshAsync(string refreshToken, CancellationToken ct = default);
    Task RevokeAsync(string refreshToken, CancellationToken ct = default);
    Task<List<AzureProfileInfo>> GetAzureProfilesAsync(CancellationToken ct = default);
    Task<bool> CheckUserExistsAsync(string email, CancellationToken ct = default);
}
