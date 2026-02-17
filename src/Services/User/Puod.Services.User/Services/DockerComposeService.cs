using System.Diagnostics;
using System.Linq;

namespace Puod.Services.User.Services;

public class DockerComposeService
{
    private const string PostgresContainerName = "puod-postgres";
    private const string PostgresVolumeName = "postgres_data";
    private readonly ILogger<DockerComposeService> _logger;
    private readonly IWebHostEnvironment _environment;

    public DockerComposeService(ILogger<DockerComposeService> logger, IWebHostEnvironment environment)
    {
        _logger = logger;
        _environment = environment;
    }

    public async Task<(bool Success, string Message, long ElapsedMs)> StartPostgresAsync(
        string database,
        string user,
        string password,
        CancellationToken ct)
    {
        var sw = Stopwatch.StartNew();
        try
        {
            var composeFile = FindComposeFile(_environment.ContentRootPath);
            var args = $"compose -f \"{composeFile}\" up -d postgres";
            var env = new Dictionary<string, string>
            {
                ["PUOD_POSTGRES_DB"] = database,
                ["PUOD_POSTGRES_USER"] = user,
                ["PUOD_POSTGRES_PASSWORD"] = password
            };
            var result = await RunProcessAsync("docker", args, Path.GetDirectoryName(composeFile) ?? _environment.ContentRootPath, ct, env);
            sw.Stop();
            if (result.ExitCode != 0)
            {
                var message = string.IsNullOrWhiteSpace(result.Error)
                    ? result.Output
                    : result.Error;
                return (false, $"Docker compose failed: {message}", sw.ElapsedMilliseconds);
            }

            return (true, "Docker postgres started.", sw.ElapsedMilliseconds);
        }
        catch (Exception ex)
        {
            sw.Stop();
            _logger.LogWarning(ex, "Docker compose start failed.");
            return (false, $"Docker compose error: {ex.Message}", sw.ElapsedMilliseconds);
        }
    }

    public async Task<(bool Exists, bool Running, string? Status)> GetPostgresStatusAsync(CancellationToken ct)
    {
        try
        {
            var result = await RunProcessAsync("docker", $"ps -a --filter \"name={PostgresContainerName}\" --format \"{{{{.Names}}}}|{{{{.Status}}}}\"", _environment.ContentRootPath, ct);
            if (result.ExitCode != 0 || string.IsNullOrWhiteSpace(result.Output))
            {
                return (false, false, null);
            }

            var line = result.Output.Split(Environment.NewLine, StringSplitOptions.RemoveEmptyEntries).FirstOrDefault();
            if (string.IsNullOrWhiteSpace(line))
            {
                return (false, false, null);
            }

            var parts = line.Split('|');
            var status = parts.Length > 1 ? parts[1] : string.Empty;
            var running = status.StartsWith("Up", StringComparison.OrdinalIgnoreCase);
            return (true, running, status);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Docker CLI not available to check postgres status.");
            return (false, false, "docker-unavailable");
        }
    }

    public async Task<(bool Success, string Message, string? BackupPath)> BackupPostgresAsync(
        string database,
        string user,
        string password,
        string backupDirectory,
        CancellationToken ct)
    {
        Directory.CreateDirectory(backupDirectory);
        var timestamp = DateTime.UtcNow.ToString("yyyyMMdd_HHmmss");
        var backupFile = Path.Combine(backupDirectory, $"puod_postgres_{timestamp}.sql");
        var containerPath = "/tmp/puod_backup.sql";

        var dumpArgs = $"exec -e PGPASSWORD={password} {PostgresContainerName} pg_dump -U {user} -d {database} -f {containerPath}";
        var dumpResult = await RunProcessAsync("docker", dumpArgs, _environment.ContentRootPath, ct);
        if (dumpResult.ExitCode != 0)
        {
            var message = string.IsNullOrWhiteSpace(dumpResult.Error) ? dumpResult.Output : dumpResult.Error;
            return (false, $"Backup failed: {message}", null);
        }

        var copyArgs = $"cp {PostgresContainerName}:{containerPath} \"{backupFile}\"";
        var copyResult = await RunProcessAsync("docker", copyArgs, _environment.ContentRootPath, ct);
        if (copyResult.ExitCode != 0)
        {
            var message = string.IsNullOrWhiteSpace(copyResult.Error) ? copyResult.Output : copyResult.Error;
            return (false, $"Backup copy failed: {message}", null);
        }

        await RunProcessAsync("docker", $"exec {PostgresContainerName} rm -f {containerPath}", _environment.ContentRootPath, ct);
        return (true, "Backup completed.", backupFile);
    }

    public async Task<(bool Success, string Message)> RemovePostgresAsync(bool removeVolume, CancellationToken ct)
    {
        // Stop container first
        var stopContainer = await RunProcessAsync("docker", $"stop {PostgresContainerName}", _environment.ContentRootPath, ct);
        if (stopContainer.ExitCode != 0 && !string.IsNullOrWhiteSpace(stopContainer.Error))
        {
            if (!stopContainer.Error.Contains("No such container", StringComparison.OrdinalIgnoreCase))
            {
                _logger.LogWarning("Failed to stop container (continuing): {Error}", stopContainer.Error);
            }
        }

        // Remove container
        var removeContainer = await RunProcessAsync("docker", $"rm -f {PostgresContainerName}", _environment.ContentRootPath, ct);
        if (removeContainer.ExitCode != 0 && !string.IsNullOrWhiteSpace(removeContainer.Error))
        {
            if (!removeContainer.Error.Contains("No such container", StringComparison.OrdinalIgnoreCase))
            {
                return (false, $"Remove container failed: {removeContainer.Error}");
            }
        }

        if (removeVolume)
        {
            var removeVol = await RunProcessAsync("docker", $"volume rm {PostgresVolumeName}", _environment.ContentRootPath, ct);
            if (removeVol.ExitCode != 0)
            {
                var volumeMessage = string.Join(" ", new[] { removeVol.Output, removeVol.Error }).Trim();
                if (!volumeMessage.Contains("no such volume", StringComparison.OrdinalIgnoreCase))
                {
                    return (false, $"Remove volume failed: {volumeMessage}");
                }
            }
        }

        return (true, "Postgres removed.");
    }

    private static string FindComposeFile(string startPath)
    {
        var current = new DirectoryInfo(startPath);
        while (current != null)
        {
            var candidate = Path.Combine(current.FullName, "docker-compose.yml");
            if (File.Exists(candidate))
            {
                return candidate;
            }

            current = current.Parent;
        }

        throw new FileNotFoundException("docker-compose.yml not found.");
    }

    private static async Task<(int ExitCode, string Output, string Error)> RunProcessAsync(
        string fileName,
        string arguments,
        string workingDirectory,
        CancellationToken ct,
        IDictionary<string, string>? environmentOverrides = null)
    {
        using var process = new Process
        {
            StartInfo = new ProcessStartInfo
            {
                FileName = fileName,
                Arguments = arguments,
                WorkingDirectory = workingDirectory,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                UseShellExecute = false,
                CreateNoWindow = true
            }
        };

        if (environmentOverrides != null)
        {
            foreach (var entry in environmentOverrides)
            {
                process.StartInfo.Environment[entry.Key] = entry.Value;
            }
        }

        process.Start();
        var outputTask = process.StandardOutput.ReadToEndAsync();
        var errorTask = process.StandardError.ReadToEndAsync();
        await process.WaitForExitAsync(ct);
        var output = await outputTask;
        var error = await errorTask;
        return (process.ExitCode, output.Trim(), error.Trim());
    }
}
