using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Data.SqlClient;
using System.IO;
using System.Net.Sockets;
using MySqlConnector;
using Npgsql;
using Puod.Services.User.Constants;
using Puod.Services.User.Data;
using Puod.Services.User.DTOs;
using Puod.Services.User.Services;

namespace Puod.Services.User.Controllers;

[ApiController]
[Route("api/v{version:apiVersion}/bootstrap")]
[Asp.Versioning.ApiVersion(1.0)]
public class BootstrapController : ControllerBase
{
    private const string PostgresMigrationsAssembly = "Puod.Services.User.Migrations.Postgres";
    private const string SqlServerMigrationsAssembly = "Puod.Services.User.Migrations.SqlServer";
    private const string MySqlMigrationsAssembly = "Puod.Services.User.Migrations.MySql";
    private readonly BootstrapDatabaseStore _store;
    private readonly IConfiguration _configuration;
    private readonly BootstrapConnectionTester _tester;
    private readonly DockerComposeService _dockerComposeService;
    private readonly IWebHostEnvironment _environment;
    private readonly DatabaseReadinessChecker _readinessChecker;
    private readonly RoleLinkSchemaEnsurer _schemaEnsurer;
    private readonly ILogger<BootstrapController> _logger;

    public BootstrapController(
        BootstrapDatabaseStore store,
        IConfiguration configuration,
        BootstrapConnectionTester tester,
        DockerComposeService dockerComposeService,
        IWebHostEnvironment environment,
        DatabaseReadinessChecker readinessChecker,
        RoleLinkSchemaEnsurer schemaEnsurer,
        ILogger<BootstrapController> logger)
    {
        _store = store;
        _configuration = configuration;
        _tester = tester;
        _dockerComposeService = dockerComposeService;
        _environment = environment;
        _readinessChecker = readinessChecker;
        _schemaEnsurer = schemaEnsurer;
        _logger = logger;
    }

    [HttpGet("database")]
    [AllowAnonymous]
    public async Task<ActionResult<DatabaseBootstrapStatus>> GetDatabase(CancellationToken ct)
    {
        var config = await _store.LoadAsync(ct);

        var provider = config?.Provider
                       ?? _configuration.GetValue<string>("DatabaseProvider")
                       ?? "postgres";
        var connection = config?.ConnectionString ?? string.Empty;

        if (config != null && config.ProvisionedAt.HasValue && !string.IsNullOrWhiteSpace(config.ConnectionString))
        {
            var tablesReady = await _readinessChecker.HasUsersTableAsync(config, ct);
            if (!tablesReady)
            {
                config.ProvisionedAt = null;
                await _store.SaveAsync(config, ct);
            }
        }

        return Ok(new DatabaseBootstrapStatus(provider, MaskConnectionString(connection), config?.UpdatedAt, config?.ProvisionedAt));
    }

    [HttpPost("database")]
    [Authorize(Policy = "SystemAdmin")]
    public async Task<ActionResult<DatabaseBootstrapStatus>> SetDatabase([FromBody] DatabaseBootstrapRequest request, CancellationToken ct)
    {
        var provider = NormalizeProvider(request.Provider);
        if (provider == null)
        {
            return BadRequest(new { message = "Unsupported provider. Use postgres, sqlserver or mysql." });
        }

        if (string.IsNullOrWhiteSpace(request.ConnectionString))
        {
            return BadRequest(new { message = "Connection string is required." });
        }

        var config = new BootstrapDatabaseConfig
        {
            Provider = provider,
            ConnectionString = request.ConnectionString,
            UpdatedAt = DateTime.UtcNow,
            ProvisionedAt = null
        };

        await _store.SaveAsync(config, ct);

        return Ok(new DatabaseBootstrapStatus(provider, MaskConnectionString(config.ConnectionString), config.UpdatedAt, config.ProvisionedAt));
    }

    [HttpPost("provision")]
    [Authorize(Policy = "SystemAdmin")]
    public async Task<ActionResult<DatabaseBootstrapStatus>> ProvisionDatabase(CancellationToken ct)
    {
        var config = await _store.LoadAsync(ct);
        if (config == null || string.IsNullOrWhiteSpace(config.ConnectionString))
        {
            return BadRequest(new { message = "Database connection is not configured." });
        }

        var provider = NormalizeProvider(config.Provider);
        if (provider == null)
        {
            return BadRequest(new { message = "Unsupported provider. Use postgres, sqlserver or mysql." });
        }

        var adminConnectionString = BuildAdminConnectionString(provider, config.ConnectionString);
        var ready = await WaitForDatabaseReadyAsync(provider, adminConnectionString, TimeSpan.FromSeconds(90), ct);
        if (!ready)
        {
            return StatusCode(StatusCodes.Status503ServiceUnavailable, new
            {
                message = "Database is not ready yet. Try again in a few seconds."
            });
        }

        await EnsureDatabaseExistsWithRetryAsync(provider, config.ConnectionString, ct);

        var options = new DbContextOptionsBuilder<PuodDbContext>();
        if (provider == "sqlserver")
        {
            options.UseSqlServer(
                config.ConnectionString,
                sql => sql.MigrationsAssembly(SqlServerMigrationsAssembly));
        }
        else if (provider == "mysql")
        {
            options.UseMySql(
                config.ConnectionString,
                ServerVersion.AutoDetect(config.ConnectionString),
                mysql => mysql.MigrationsAssembly(MySqlMigrationsAssembly));
        }
        else
        {
            options.UseNpgsql(
                config.ConnectionString,
                postgres => postgres.MigrationsAssembly(PostgresMigrationsAssembly));
        }

        await using var dbContext = new PuodDbContext(options.Options);
        await MigrateWithRetryAsync(dbContext, provider, ct);
        await _schemaEnsurer.EnsureAsync(dbContext, provider, ct);

        var tablesReady = await _readinessChecker.HasUsersTableAsync(config, ct);
        if (!tablesReady)
        {
            return StatusCode(StatusCodes.Status503ServiceUnavailable, new
            {
                message = "Database tables are not ready yet. Try again in a few seconds."
            });
        }

        config.ProvisionedAt = DateTime.UtcNow;
        await _store.SaveAsync(config, ct);

        return Ok(new DatabaseBootstrapStatus(provider, MaskConnectionString(config.ConnectionString), config.UpdatedAt, config.ProvisionedAt));
    }

    [HttpPost("test-connection")]
    [Authorize(Policy = "SystemAdmin")]
    public async Task<ActionResult<DatabaseConnectionTestResponse>> TestConnection([FromBody] DatabaseConnectionTestRequest request, CancellationToken ct)
    {
        var provider = NormalizeProvider(request.Provider);
        if (provider == null)
        {
            return BadRequest(new { message = "Unsupported provider. Use postgres, sqlserver or mysql." });
        }

        if (string.IsNullOrWhiteSpace(request.ConnectionString))
        {
            return BadRequest(new { message = "Connection string is required." });
        }

        var (success, message, elapsed) = await _tester.TestAsync(provider, request.ConnectionString, ct);
        return Ok(new DatabaseConnectionTestResponse(success, message, elapsed));
    }

    [HttpPost("docker/postgres")]
    [Authorize(Policy = "SystemAdmin")]
    public async Task<ActionResult<DockerPostgresStartResponse>> StartDockerPostgres(
        [FromBody] DockerPostgresStartRequest request,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.ConnectionString))
        {
            return BadRequest(new { message = "Connection string is required." });
        }

        var builder = new NpgsqlConnectionStringBuilder(request.ConnectionString);
        var database = builder.Database;
        var user = builder.Username;
        var password = builder.Password;

        if (string.IsNullOrWhiteSpace(database) || string.IsNullOrWhiteSpace(user) || string.IsNullOrWhiteSpace(password))
        {
            return BadRequest(new { message = "Database credentials are required." });
        }

        var (success, message, elapsed) = await _dockerComposeService.StartPostgresAsync(database, user, password, ct);
        if (!success)
        {
            return Ok(new DockerPostgresStartResponse(false, message, elapsed));
        }

        var timeout = TimeSpan.FromSeconds(request.TimeoutSeconds <= 0 ? 60 : request.TimeoutSeconds);
        var started = DateTime.UtcNow;
        while (DateTime.UtcNow - started < timeout)
        {
            var (ready, testMessage, testElapsed) = await _tester.TestAsync("postgres", request.ConnectionString, ct);
            if (ready)
            {
                return Ok(new DockerPostgresStartResponse(true, "Docker postgres ready.", elapsed + testElapsed));
            }

            await Task.Delay(TimeSpan.FromSeconds(3), ct);
        }

        return Ok(new DockerPostgresStartResponse(false, "Docker postgres started but database is not ready yet.", elapsed));
    }

    [HttpGet("docker/postgres/status")]
    [Authorize(Policy = "SystemAdmin")]
    public async Task<ActionResult<DockerPostgresStatusResponse>> GetDockerPostgresStatus(CancellationToken ct)
    {
        var status = await _dockerComposeService.GetPostgresStatusAsync(ct);
        var config = await _store.LoadAsync(ct);
        var configured = false;
        string? username = null;

        if (config != null && NormalizeProvider(config.Provider) == "postgres" && !string.IsNullOrWhiteSpace(config.ConnectionString))
        {
            configured = true;
            try
            {
                var builder = new NpgsqlConnectionStringBuilder(config.ConnectionString);
                username = builder.Username;
            }
            catch
            {
                username = null;
            }
        }

        return Ok(new DockerPostgresStatusResponse(status.Exists, status.Running, status.Status, configured, username));
    }

    [HttpPost("docker/postgres/recreate")]
    [Authorize(Policy = "SystemAdmin")]
    public async Task<ActionResult<DockerPostgresRecreateResponse>> RecreateDockerPostgres(
        [FromBody] DockerPostgresRecreateRequest request,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.ConnectionString))
        {
            return BadRequest(new DockerPostgresRecreateResponse(
                false,
                BootstrapCodes.RecreateMissingConnection,
                "Connection string is required.",
                null));
        }

        var builder = new NpgsqlConnectionStringBuilder(request.ConnectionString);
        var database = builder.Database;
        var user = builder.Username;
        var password = builder.Password;

        if (string.IsNullOrWhiteSpace(database) || string.IsNullOrWhiteSpace(user) || string.IsNullOrWhiteSpace(password))
        {
            return BadRequest(new DockerPostgresRecreateResponse(
                false,
                BootstrapCodes.RecreateMissingCredentials,
                "Database credentials are required.",
                null));
        }

        string? backupPath = null;
        bool backupFailed = false;
        string? backupFailureReason = null;

        if (request.Backup)
        {
            var backupDir = Path.Combine(_environment.ContentRootPath, "backups");
            var backup = await _dockerComposeService.BackupPostgresAsync(database, user, password, backupDir, ct);
            if (!backup.Success)
            {
                backupFailed = true;
                backupFailureReason = backup.Message;
                _logger.LogWarning("Backup failed but continuing with recreate. Reason: {Reason}", backup.Message);
            }
            else
            {
                backupPath = backup.BackupPath;
            }
        }

        var removed = await _dockerComposeService.RemovePostgresAsync(removeVolume: true, ct);
        if (!removed.Success)
        {
            return BadRequest(new DockerPostgresRecreateResponse(
                false,
                BootstrapCodes.RecreateRemoveFailed,
                removed.Message,
                backupPath));
        }

        var (startSuccess, startMessage, elapsed) = await _dockerComposeService.StartPostgresAsync(database, user, password, ct);
        if (!startSuccess)
        {
            var code = backupFailed ? BootstrapCodes.RecreateStartFailedNoBackup : BootstrapCodes.RecreateStartFailed;
            var message = backupFailed
                ? $"Container removed but startup failed: {startMessage}. Backup was not available: {backupFailureReason}"
                : $"Container removed but startup failed: {startMessage}";
            return Ok(new DockerPostgresRecreateResponse(false, code, message, backupPath));
        }

        var timeout = TimeSpan.FromSeconds(request.TimeoutSeconds <= 0 ? 60 : request.TimeoutSeconds);
        var started = DateTime.UtcNow;
        while (DateTime.UtcNow - started < timeout)
        {
            var (ready, testMessage, testElapsed) = await _tester.TestAsync("postgres", request.ConnectionString, ct);
            if (ready)
            {
                var code = backupFailed ? BootstrapCodes.RecreateSuccessNoBackup : BootstrapCodes.RecreateSuccess;
                var message = backupFailed
                    ? $"PostgreSQL recreated successfully. Warning: Backup failed ({backupFailureReason}), data was lost."
                    : "PostgreSQL recreated successfully.";
                return Ok(new DockerPostgresRecreateResponse(true, code, message, backupPath));
            }

            await Task.Delay(TimeSpan.FromSeconds(3), ct);
        }

        var timeoutCode = backupFailed ? BootstrapCodes.RecreateTimeoutNoBackup : BootstrapCodes.RecreateTimeout;
        var timeoutMessage = backupFailed
            ? $"Container started but not ready within {timeout.TotalSeconds}s. Warning: Backup failed ({backupFailureReason}), data was lost."
            : $"Container started but not ready within {timeout.TotalSeconds}s.";
        return Ok(new DockerPostgresRecreateResponse(false, timeoutCode, timeoutMessage, backupPath));
    }

    [HttpGet("docker/postgres/backup")]
    [Authorize(Policy = "SystemAdmin")]
    public ActionResult DownloadDockerPostgresBackup([FromQuery] string fileName)
    {
        if (string.IsNullOrWhiteSpace(fileName))
        {
            return BadRequest(new { message = "Backup file name is required." });
        }

        var safeName = Path.GetFileName(fileName);
        var backupDir = Path.Combine(_environment.ContentRootPath, "backups");
        var fullPath = Path.Combine(backupDir, safeName);
        if (!System.IO.File.Exists(fullPath))
        {
            return NotFound(new { message = "Backup file not found." });
        }

        return PhysicalFile(fullPath, "application/octet-stream", safeName);
    }

    private static string? NormalizeProvider(string provider)
    {
        if (string.IsNullOrWhiteSpace(provider))
        {
            return null;
        }

        var value = provider.Trim().ToLowerInvariant();
        return value switch
        {
            "postgres" => "postgres",
            "postgresql" => "postgres",
            "sqlserver" => "sqlserver",
            "mssql" => "sqlserver",
            "mysql" => "mysql",
            _ => null
        };
    }

    private static string MaskConnectionString(string value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return string.Empty;
        }

        return value.Length <= 8 ? "****" : $"{value[..4]}****{value[^4..]}";
    }

    private static async Task EnsureDatabaseExistsAsync(string provider, string connectionString, CancellationToken ct)
    {
        if (provider == "postgres")
        {
            var builder = new NpgsqlConnectionStringBuilder(connectionString);
            var database = builder.Database;
            if (string.IsNullOrWhiteSpace(database))
            {
                return;
            }
            builder.Database = "postgres";
            await using var connection = new NpgsqlConnection(builder.ConnectionString);
            await connection.OpenAsync(ct);
            await using var command = new NpgsqlCommand(
                "SELECT 1 FROM pg_database WHERE datname = @name",
                connection);
            command.Parameters.AddWithValue("name", database);
            var exists = await command.ExecuteScalarAsync(ct);
            if (exists == null)
            {
                var safeName = database.Replace("\"", "\"\"");
                await using var createCommand = new NpgsqlCommand($"CREATE DATABASE \"{safeName}\"", connection);
                await createCommand.ExecuteNonQueryAsync(ct);
            }
            return;
        }

        if (provider == "sqlserver")
        {
            var builder = new SqlConnectionStringBuilder(connectionString);
            var database = builder.InitialCatalog;
            if (string.IsNullOrWhiteSpace(database))
            {
                return;
            }
            builder.InitialCatalog = "master";
            await using var connection = new SqlConnection(builder.ConnectionString);
            await connection.OpenAsync(ct);
            await using var command = new SqlCommand(
                "SELECT 1 FROM sys.databases WHERE name = @name",
                connection);
            command.Parameters.AddWithValue("@name", database);
            var exists = await command.ExecuteScalarAsync(ct);
            if (exists == null)
            {
                var safeName = database.Replace("]", "]]");
                await using var createCommand = new SqlCommand($"CREATE DATABASE [{safeName}]", connection);
                await createCommand.ExecuteNonQueryAsync(ct);
            }
            return;
        }

        if (provider == "mysql")
        {
            var builder = new MySqlConnectionStringBuilder(connectionString);
            var database = builder.Database;
            if (string.IsNullOrWhiteSpace(database))
            {
                return;
            }
            builder.Database = string.Empty;
            await using var connection = new MySqlConnection(builder.ConnectionString);
            await connection.OpenAsync(ct);
            var safeName = database.Replace("`", "``");
            await using var command = new MySqlCommand($"CREATE DATABASE IF NOT EXISTS `{safeName}`", connection);
            await command.ExecuteNonQueryAsync(ct);
        }
    }

    private async Task EnsureDatabaseExistsWithRetryAsync(string provider, string connectionString, CancellationToken ct)
    {
        var delay = TimeSpan.FromSeconds(2);
        const int maxAttempts = 4;

        for (var attempt = 1; attempt <= maxAttempts; attempt += 1)
        {
            try
            {
                await EnsureDatabaseExistsAsync(provider, connectionString, ct);
                return;
            }
            catch (Exception ex) when (IsTransientMigrationError(ex, provider) && attempt < maxAttempts)
            {
                _logger.LogWarning(ex, "Transient database create error (attempt {Attempt}/{Max}). Retrying...", attempt, maxAttempts);
                await Task.Delay(delay, ct);
                delay = TimeSpan.FromSeconds(delay.TotalSeconds * 2);
            }
        }

        await EnsureDatabaseExistsAsync(provider, connectionString, ct);
    }

    private static string BuildAdminConnectionString(string provider, string connectionString)
    {
        if (provider == "postgres")
        {
            var builder = new NpgsqlConnectionStringBuilder(connectionString)
            {
                Database = "postgres"
            };
            return builder.ConnectionString;
        }

        if (provider == "sqlserver")
        {
            var builder = new SqlConnectionStringBuilder(connectionString)
            {
                InitialCatalog = "master"
            };
            return builder.ConnectionString;
        }

        if (provider == "mysql")
        {
            var builder = new MySqlConnectionStringBuilder(connectionString)
            {
                Database = string.Empty
            };
            return builder.ConnectionString;
        }

        return connectionString;
    }

    private async Task<bool> WaitForDatabaseReadyAsync(string provider, string connectionString, TimeSpan timeout, CancellationToken ct)
    {
        var started = DateTime.UtcNow;
        while (DateTime.UtcNow - started < timeout)
        {
            var (success, _, _) = await _tester.TestAsync(provider, connectionString, ct);
            if (success)
            {
                return true;
            }

            await Task.Delay(TimeSpan.FromSeconds(3), ct);
        }

        return false;
    }

    private async Task MigrateWithRetryAsync(PuodDbContext dbContext, string provider, CancellationToken ct)
    {
        var delay = TimeSpan.FromSeconds(3);
        const int maxAttempts = 4;

        for (var attempt = 1; attempt <= maxAttempts; attempt += 1)
        {
            try
            {
                await dbContext.Database.MigrateAsync(ct);
                return;
            }
            catch (Exception ex) when (IsTransientMigrationError(ex, provider) && attempt < maxAttempts)
            {
                _logger.LogWarning(ex, "Transient migration error (attempt {Attempt}/{Max}). Retrying...", attempt, maxAttempts);
                await Task.Delay(delay, ct);
                delay = TimeSpan.FromSeconds(delay.TotalSeconds * 2);
            }
        }

        await dbContext.Database.MigrateAsync(ct);
    }

    private static bool IsTransientMigrationError(Exception ex, string provider)
    {
        if (!string.Equals(provider, "postgres", StringComparison.OrdinalIgnoreCase))
        {
            return ex is IOException || ex is SocketException;
        }

        return ex is NpgsqlException || ex is IOException || ex is SocketException;
    }
}
