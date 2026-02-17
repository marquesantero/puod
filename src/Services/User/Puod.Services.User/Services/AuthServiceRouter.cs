using Puod.Services.User.DTOs;

namespace Puod.Services.User.Services;

public class AuthServiceRouter : IAuthService
{
    private readonly BootstrapDatabaseStore _store;
    private readonly DatabaseReadinessChecker _readinessChecker;
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<AuthServiceRouter> _logger;

    public AuthServiceRouter(
        BootstrapDatabaseStore store,
        DatabaseReadinessChecker readinessChecker,
        IServiceProvider serviceProvider,
        ILogger<AuthServiceRouter> logger)
    {
        _store = store;
        _readinessChecker = readinessChecker;
        _serviceProvider = serviceProvider;
        _logger = logger;
    }

    public async Task<LoginResponse> RegisterAsync(RegisterRequest request, CancellationToken ct = default)
    {
        var service = await ResolveAsync(ct);
        return await service.RegisterAsync(request, ct);
    }

    public async Task<LoginResponse> LoginAsync(LoginRequest request, CancellationToken ct = default)
    {
        // Always allow bootstrap admin login even after setup
        if (request.Email?.Trim().Equals("puod_admin", StringComparison.OrdinalIgnoreCase) == true)
        {
            _logger.LogInformation("Auth routed to bootstrap service for puod_admin user.");
            var bootstrapService = _serviceProvider.GetRequiredService<BootstrapAuthService>();
            return await bootstrapService.LoginAsync(request, ct);
        }

        var service = await ResolveAsync(ct);
        return await service.LoginAsync(request, ct);
    }

    public async Task<DiscoveryResponse> DiscoverAsync(string email, CancellationToken ct = default)
    {
        var service = await ResolveAsync(ct);
        return await service.DiscoverAsync(email, ct);
    }

    public async Task<LoginResponse> CallbackAsync(CallbackRequest request, CancellationToken ct = default)
    {
        var service = await ResolveAsync(ct);
        return await service.CallbackAsync(request, ct);
    }

    public async Task<LoginResponse> RefreshAsync(string refreshToken, CancellationToken ct = default)
    {
        var service = await ResolveAsync(ct);
        return await service.RefreshAsync(refreshToken, ct);
    }

    public async Task RevokeAsync(string refreshToken, CancellationToken ct = default)
    {
        var service = await ResolveAsync(ct);
        await service.RevokeAsync(refreshToken, ct);
    }

    public async Task<List<AzureProfileInfo>> GetAzureProfilesAsync(CancellationToken ct = default)
    {
        var service = await ResolveAsync(ct);
        return await service.GetAzureProfilesAsync(ct);
    }

    public async Task<bool> CheckUserExistsAsync(string email, CancellationToken ct = default)
    {
        var service = await ResolveAsync(ct);
        return await service.CheckUserExistsAsync(email, ct);
    }

    private async Task<IAuthService> ResolveAsync(CancellationToken ct)
    {
        var config = await _store.LoadAsync(ct);
        if (config == null || string.IsNullOrWhiteSpace(config.ConnectionString))
        {
            _logger.LogInformation("Auth routed to bootstrap service. ProvisionedAt={ProvisionedAt} HasConnection={HasConnection}",
                config?.ProvisionedAt,
                !string.IsNullOrWhiteSpace(config?.ConnectionString));
            return _serviceProvider.GetRequiredService<BootstrapAuthService>();
        }

        var ready = await _readinessChecker.HasUsersTableAsync(config, ct);
        if (!ready)
        {
            _logger.LogWarning("Auth routed to bootstrap service because database tables are not ready yet.");
            return _serviceProvider.GetRequiredService<BootstrapAuthService>();
        }

        _logger.LogInformation("Auth routed to database-backed service.");
        return _serviceProvider.GetRequiredService<AuthService>();
    }
}
