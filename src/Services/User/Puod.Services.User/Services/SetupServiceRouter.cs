using Puod.Services.User.DTOs;

namespace Puod.Services.User.Services;

public class SetupServiceRouter : ISetupService
{
    private readonly BootstrapDatabaseStore _store;
    private readonly DatabaseReadinessChecker _readinessChecker;
    private readonly IServiceProvider _serviceProvider;
    private readonly IConfiguration _configuration;
    private readonly ILogger<SetupServiceRouter> _logger;

    public SetupServiceRouter(
        BootstrapDatabaseStore store,
        DatabaseReadinessChecker readinessChecker,
        IServiceProvider serviceProvider,
        IConfiguration configuration,
        ILogger<SetupServiceRouter> logger)
    {
        _store = store;
        _readinessChecker = readinessChecker;
        _serviceProvider = serviceProvider;
        _configuration = configuration;
        _logger = logger;
    }

    public async Task<SetupStatusResponse> GetStatusAsync(CancellationToken ct)
    {
        var service = await ResolveAsync(ct);
        return await service.GetStatusAsync(ct);
    }

    public async Task<SetupStepsResponse> GetStepsAsync(CancellationToken ct)
    {
        var service = await ResolveAsync(ct);
        return await service.GetStepsAsync(ct);
    }

    public async Task SaveStepAsync(SetupStepSaveRequest request, CancellationToken ct)
    {
        var service = await ResolveAsync(ct);
        await service.SaveStepAsync(request, ct);
    }

    public async Task ClearStepAsync(SetupStepClearRequest request, CancellationToken ct)
    {
        var service = await ResolveAsync(ct);
        await service.ClearStepAsync(request, ct);
    }

    public async Task<TenantCreateResponse> CreateTenantAsync(TenantCreateRequest request, long actorUserId, CancellationToken ct)
    {
        var service = await ResolveAsync(ct);
        return await service.CreateTenantAsync(request, actorUserId, ct);
    }

    private async Task<ISetupService> ResolveAsync(CancellationToken ct)
    {
        var config = await _store.LoadAsync(ct);

        var envConnectionString = Environment.GetEnvironmentVariable("ConnectionString")
                                  ?? Environment.GetEnvironmentVariable("CONNECTIONSTRING")
                                  ?? Environment.GetEnvironmentVariable("ConnectionStrings__DefaultConnection")
                                  ?? _configuration.GetValue<string>("ConnectionString")
                                  ?? _configuration.GetConnectionString("DefaultConnection");

        var effectiveConfig = config;
        if (!string.IsNullOrWhiteSpace(envConnectionString))
        {
            effectiveConfig ??= new BootstrapDatabaseConfig();
            effectiveConfig.ConnectionString = envConnectionString;
        }

        if (effectiveConfig == null || string.IsNullOrWhiteSpace(effectiveConfig.ConnectionString))
        {
            _logger.LogInformation("Setup routed to bootstrap service. ProvisionedAt={ProvisionedAt} HasConnection={HasConnection}",
                config?.ProvisionedAt,
                !string.IsNullOrWhiteSpace(config?.ConnectionString));
            return _serviceProvider.GetRequiredService<BootstrapSetupService>();
        }

        var ready = await _readinessChecker.HasUsersTableAsync(effectiveConfig, ct);
        if (!ready)
        {
            _logger.LogWarning("Setup routed to bootstrap service because database tables are not ready yet.");
            return _serviceProvider.GetRequiredService<BootstrapSetupService>();
        }

        _logger.LogInformation("Setup routed to database-backed service.");
        return _serviceProvider.GetRequiredService<SetupService>();
    }
}
