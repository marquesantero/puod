namespace Puod.Services.User.Constants;

/// <summary>
/// Response codes for Bootstrap API endpoints.
/// Used by frontend for i18n translation.
/// </summary>
public static class BootstrapCodes
{
    // Docker Postgres Recreate
    public const string RecreateSuccess = "RECREATE_SUCCESS";
    public const string RecreateSuccessNoBackup = "RECREATE_SUCCESS_NO_BACKUP";
    public const string RecreateTimeout = "RECREATE_TIMEOUT";
    public const string RecreateTimeoutNoBackup = "RECREATE_TIMEOUT_NO_BACKUP";
    public const string RecreateRemoveFailed = "RECREATE_REMOVE_FAILED";
    public const string RecreateStartFailed = "RECREATE_START_FAILED";
    public const string RecreateStartFailedNoBackup = "RECREATE_START_FAILED_NO_BACKUP";
    public const string RecreateMissingConnection = "RECREATE_MISSING_CONNECTION";
    public const string RecreateMissingCredentials = "RECREATE_MISSING_CREDENTIALS";

    // Database operations
    public const string DatabaseTestSuccess = "DATABASE_TEST_SUCCESS";
    public const string DatabaseTestFailed = "DATABASE_TEST_FAILED";
    public const string DatabaseProvisionSuccess = "DATABASE_PROVISION_SUCCESS";
    public const string DatabaseProvisionFailed = "DATABASE_PROVISION_FAILED";

    // Docker Postgres Start
    public const string DockerStartSuccess = "DOCKER_START_SUCCESS";
    public const string DockerStartFailed = "DOCKER_START_FAILED";
    public const string DockerStartTimeout = "DOCKER_START_TIMEOUT";
}
