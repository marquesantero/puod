using Microsoft.Data.SqlClient;
using MySqlConnector;
using Npgsql;

namespace Puod.Services.User.Services;

public class DatabaseReadinessChecker
{
    private const string UsersTable = "users";

    public async Task<bool> HasUsersTableAsync(BootstrapDatabaseConfig config, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(config.ConnectionString))
        {
            return false;
        }

        var provider = NormalizeProvider(config.Provider);
        if (provider == null)
        {
            return false;
        }

        try
        {
            if (provider == "sqlserver")
            {
                await using var connection = new SqlConnection(config.ConnectionString);
                await connection.OpenAsync(ct);
                await using var command = new SqlCommand(
                    "SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = @table",
                    connection);
                command.Parameters.AddWithValue("@table", UsersTable);
                var result = await command.ExecuteScalarAsync(ct);
                return result != null;
            }

            if (provider == "mysql")
            {
                await using var connection = new MySqlConnection(config.ConnectionString);
                await connection.OpenAsync(ct);
                await using var command = new MySqlCommand(
                    "SELECT 1 FROM information_schema.tables WHERE table_schema = database() AND table_name = @table LIMIT 1",
                    connection);
                command.Parameters.AddWithValue("@table", UsersTable);
                var result = await command.ExecuteScalarAsync(ct);
                return result != null;
            }

            await using var postgres = new NpgsqlConnection(config.ConnectionString);
            await postgres.OpenAsync(ct);
            await using var postgresCommand = new NpgsqlCommand(
                "SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = @table LIMIT 1",
                postgres);
            postgresCommand.Parameters.AddWithValue("table", UsersTable);
            var pgResult = await postgresCommand.ExecuteScalarAsync(ct);
            return pgResult != null;
        }
        catch
        {
            return false;
        }
    }

    private static string? NormalizeProvider(string? provider)
    {
        var value = provider?.Trim().ToLowerInvariant();
        return value switch
        {
            "postgres" => "postgres",
            "postgresql" => "postgres",
            "sqlserver" => "sqlserver",
            "mysql" => "mysql",
            _ => null
        };
    }
}
