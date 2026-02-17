using Puod.Services.User.DTOs;

namespace Puod.Services.User.Services;

public class BootstrapSetupService : ISetupService
{
    public Task<SetupStatusResponse> GetStatusAsync(CancellationToken ct)
    {
        return Task.FromResult(new SetupStatusResponse(false, 0, null));
    }

    public Task<SetupStepsResponse> GetStepsAsync(CancellationToken ct)
    {
        return Task.FromResult(new SetupStepsResponse(Array.Empty<SetupStepStateResponse>()));
    }

    public Task SaveStepAsync(SetupStepSaveRequest request, CancellationToken ct)
    {
        throw new InvalidOperationException("Database is not configured yet. Configure it before saving steps.");
    }

    public Task ClearStepAsync(SetupStepClearRequest request, CancellationToken ct)
    {
        throw new InvalidOperationException("Database is not configured yet. Configure it before clearing steps.");
    }

    public Task<TenantCreateResponse> CreateTenantAsync(TenantCreateRequest request, long actorUserId, CancellationToken ct)
    {
        throw new InvalidOperationException("Database is not configured yet. Configure it before creating tenants.");
    }
}
