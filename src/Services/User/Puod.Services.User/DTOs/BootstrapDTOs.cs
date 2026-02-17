using System.ComponentModel.DataAnnotations;

namespace Puod.Services.User.DTOs;

public record DatabaseBootstrapRequest(
    [Required] string Provider,
    [Required] string ConnectionString
);

public record DatabaseBootstrapStatus(
    string Provider,
    string ConnectionStringMasked,
    DateTime? UpdatedAt,
    DateTime? ProvisionedAt
);

public record DatabaseConnectionTestRequest(
    [Required] string Provider,
    [Required] string ConnectionString
);

public record DatabaseConnectionTestResponse(
    bool Success,
    string Message,
    long ElapsedMilliseconds
);

public record DockerPostgresStartRequest(
    [Required] string ConnectionString,
    int TimeoutSeconds = 60
);

public record DockerPostgresStartResponse(
    bool Success,
    string Message,
    long ElapsedMilliseconds
);

public record DockerPostgresStatusResponse(
    bool Exists,
    bool Running,
    string? Status,
    bool Configured,
    string? Username
);

public record DockerPostgresRecreateRequest(
    string? ConnectionString,
    bool Backup,
    int TimeoutSeconds = 60
);

public record DockerPostgresRecreateResponse(
    bool Success,
    string Code,
    string Message,
    string? BackupPath
);
