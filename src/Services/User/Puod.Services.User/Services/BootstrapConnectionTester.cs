using System.Diagnostics;
using Microsoft.Data.SqlClient;
using MySqlConnector;
using Npgsql;

namespace Puod.Services.User.Services;

public class BootstrapConnectionTester
{
    public async Task<(bool Success, string Message, long ElapsedMs)> TestAsync(string provider, string connectionString, CancellationToken ct)
    {
        var sw = Stopwatch.StartNew();
        try
        {
            await using var connection = CreateConnection(provider, connectionString);
            if (connection == null)
            {
                return (false, "Provider nao suportado.", sw.ElapsedMilliseconds);
            }

            await connection.OpenAsync(ct);
            await connection.CloseAsync();
            sw.Stop();
            return (true, "Conexao realizada com sucesso.", sw.ElapsedMilliseconds);
        }
        catch (Exception ex)
        {
            sw.Stop();
            return (false, $"Falha ao conectar: {ex.Message}", sw.ElapsedMilliseconds);
        }
    }

    private static System.Data.Common.DbConnection? CreateConnection(string provider, string connectionString)
    {
        if (string.Equals(provider, "sqlserver", StringComparison.OrdinalIgnoreCase))
        {
            return new SqlConnection(connectionString);
        }

        if (string.Equals(provider, "mysql", StringComparison.OrdinalIgnoreCase))
        {
            return new MySqlConnection(connectionString);
        }

        if (string.Equals(provider, "postgres", StringComparison.OrdinalIgnoreCase))
        {
            return new NpgsqlConnection(connectionString);
        }

        return null;
    }
}
