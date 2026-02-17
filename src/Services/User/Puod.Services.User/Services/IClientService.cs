using Puod.Services.User.DTOs;

namespace Puod.Services.User.Services;

public interface IClientService
{
    Task<List<ClientListResponse>> GetAllAsync(CancellationToken ct);
    Task<ClientDetailResponse?> GetByIdAsync(long id, CancellationToken ct);
    Task<ClientInfoPreview?> GetInfoPreviewAsync(long id, CancellationToken ct);
    Task<ClientDetailResponse> CreateAsync(ClientCreateRequest request, long userId, CancellationToken ct);
    Task<ClientDetailResponse> UpdateAsync(long id, ClientUpdateRequest request, long userId, CancellationToken ct);
    Task DeleteAsync(long id, long userId, CancellationToken ct);
}
