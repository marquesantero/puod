using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Puod.Services.User.Data;

namespace Puod.Services.User.Services;

public sealed class RoleLinkSchemaSyncHostedService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly BootstrapDatabaseStore _bootstrapStore;
    private readonly DatabaseReadinessChecker _readinessChecker;
    private readonly RoleLinkSchemaEnsurer _schemaEnsurer;
    private readonly ILogger<RoleLinkSchemaSyncHostedService> _logger;

    public RoleLinkSchemaSyncHostedService(
        IServiceScopeFactory scopeFactory,
        BootstrapDatabaseStore bootstrapStore,
        DatabaseReadinessChecker readinessChecker,
        RoleLinkSchemaEnsurer schemaEnsurer,
        ILogger<RoleLinkSchemaSyncHostedService> logger)
    {
        _scopeFactory = scopeFactory;
        _bootstrapStore = bootstrapStore;
        _readinessChecker = readinessChecker;
        _schemaEnsurer = schemaEnsurer;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var config = await _bootstrapStore.LoadAsync(stoppingToken);
        if (config == null || string.IsNullOrWhiteSpace(config.ConnectionString))
        {
            _logger.LogDebug("Role link schema sync skipped: database not configured.");
            return;
        }

        var provider = config.Provider?.Trim().ToLowerInvariant() ?? "postgres";
        if (provider == "postgresql" || provider == "postgres-docker")
        {
            provider = "postgres";
        }

        for (var attempt = 1; attempt <= 3 && !stoppingToken.IsCancellationRequested; attempt++)
        {
            try
            {
                var tablesReady = await _readinessChecker.HasUsersTableAsync(config, stoppingToken);
                if (!tablesReady)
                {
                    _logger.LogDebug("Role link schema sync skipped: tables not ready yet.");
                    return;
                }

                using var scope = _scopeFactory.CreateScope();
                var dbContext = scope.ServiceProvider.GetRequiredService<PuodDbContext>();
                await _schemaEnsurer.EnsureAsync(dbContext, provider, stoppingToken);
                _logger.LogInformation("Role link schema sync completed.");
                return;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to sync role link schema (attempt {Attempt}/3).", attempt);
                await Task.Delay(TimeSpan.FromSeconds(2 * attempt), stoppingToken);
            }
        }
    }
}
