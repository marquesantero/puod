using System.Text.Json;

namespace Puod.Services.User.Services;

public class BootstrapDatabaseConfig
{
    public string Provider { get; set; } = "postgres";
    public string ConnectionString { get; set; } = string.Empty;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? ProvisionedAt { get; set; }
}

public class BootstrapDatabaseStore
{
    private readonly string _path;

    public BootstrapDatabaseStore(string path)
    {
        _path = path;
    }

    public async Task<BootstrapDatabaseConfig?> LoadAsync(CancellationToken ct = default)
    {
        if (!File.Exists(_path))
        {
            return null;
        }

        var json = await File.ReadAllTextAsync(_path, ct);
        return JsonSerializer.Deserialize<BootstrapDatabaseConfig>(json);
    }

    public async Task SaveAsync(BootstrapDatabaseConfig config, CancellationToken ct = default)
    {
        var directory = Path.GetDirectoryName(_path);
        if (!string.IsNullOrWhiteSpace(directory))
        {
            Directory.CreateDirectory(directory);
        }

        var json = JsonSerializer.Serialize(config, new JsonSerializerOptions
        {
            WriteIndented = true
        });

        await File.WriteAllTextAsync(_path, json, ct);
    }
}
