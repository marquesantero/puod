using System.Data.Common;
using Microsoft.EntityFrameworkCore;
using Puod.Services.User.Data;

namespace Puod.Services.User.Services;

public sealed class RoleLinkSchemaEnsurer
{
    public async Task EnsureAsync(PuodDbContext dbContext, string provider, CancellationToken ct)
    {
        var connection = dbContext.Database.GetDbConnection();
        if (connection.State != System.Data.ConnectionState.Open)
        {
            await connection.OpenAsync(ct);
        }

        var roleIdType = "bigint";

        await EnsureColumnAsync(connection, provider, "user_tenant_roles", "role_id", roleIdType, ct);
        await EnsureColumnTypeAsync(connection, provider, "user_tenant_roles", "role_id", roleIdType, ct);
        await EnsureCompanyIdsTypeAsync(connection, provider, "user_tenant_roles", ct);
        await EnsureIndexAsync(connection, provider, "user_tenant_roles", "IX_user_tenant_roles_user_id_client_id_role_id",
            "CREATE INDEX IX_user_tenant_roles_user_id_client_id_role_id ON user_tenant_roles (user_id, client_id, role_id)", ct);
        await EnsureIndexAsync(connection, provider, "user_tenant_roles", "IX_user_tenant_roles_user_id_profile_id_role_id",
            "CREATE INDEX IX_user_tenant_roles_user_id_profile_id_role_id ON user_tenant_roles (user_id, profile_id, role_id)", ct);

        await EnsureColumnAsync(connection, provider, "group_tenant_roles", "role_id", roleIdType, ct);
        await EnsureColumnTypeAsync(connection, provider, "group_tenant_roles", "role_id", roleIdType, ct);
        await EnsureCompanyIdsTypeAsync(connection, provider, "group_tenant_roles", ct);
        await EnsureIndexAsync(connection, provider, "group_tenant_roles", "IX_group_tenant_roles_role_id",
            "CREATE INDEX IX_group_tenant_roles_role_id ON group_tenant_roles (role_id)", ct);

        await EnsureCompanyIdsTypeAsync(connection, provider, "auth_profiles", ct);
        await EnsureCompanyIdsTypeAsync(connection, provider, "integration_connections", ct);
    }

    private static async Task EnsureColumnAsync(
        DbConnection connection,
        string provider,
        string table,
        string column,
        string columnType,
        CancellationToken ct)
    {
        if (!await TableExistsAsync(connection, provider, table, ct))
        {
            return;
        }

        if (await ColumnExistsAsync(connection, provider, table, column, ct))
        {
            return;
        }

        var sql = $"ALTER TABLE {table} ADD COLUMN {column} {columnType} NULL";
        await ExecuteNonQueryAsync(connection, sql, ct);
    }

    private static async Task EnsureColumnTypeAsync(
        DbConnection connection,
        string provider,
        string table,
        string column,
        string columnType,
        CancellationToken ct)
    {
        if (provider != "postgres")
        {
            return;
        }

        if (!await TableExistsAsync(connection, provider, table, ct))
        {
            return;
        }

        var udtName = await ExecuteScalarAsync(
            connection,
            "SELECT udt_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = @table AND column_name = @column",
            new Dictionary<string, object> { ["@table"] = table, ["@column"] = column },
            ct);

        if (udtName == null)
        {
            return;
        }

        if (string.Equals(udtName.ToString(), "int8", StringComparison.OrdinalIgnoreCase))
        {
            return;
        }

        var sql = $"ALTER TABLE {table} ALTER COLUMN {column} TYPE {columnType} USING NULL::{columnType}";
        await ExecuteNonQueryAsync(connection, sql, ct);
    }

    private static async Task EnsureCompanyIdsTypeAsync(
        DbConnection connection,
        string provider,
        string table,
        CancellationToken ct)
    {
        if (provider != "postgres")
        {
            return;
        }

        if (!await TableExistsAsync(connection, provider, table, ct))
        {
            return;
        }

        const string column = "company_ids";

        var udtName = await ExecuteScalarAsync(
            connection,
            "SELECT udt_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = @table AND column_name = @column",
            new Dictionary<string, object> { ["@table"] = table, ["@column"] = column },
            ct);

        if (udtName == null)
        {
            return;
        }

        if (string.Equals(udtName.ToString(), "_int8", StringComparison.OrdinalIgnoreCase))
        {
            return;
        }

        var sql = $"ALTER TABLE {table} ALTER COLUMN {column} TYPE bigint[] USING NULL::bigint[]";
        await ExecuteNonQueryAsync(connection, sql, ct);
    }

    private static async Task EnsureIndexAsync(
        DbConnection connection,
        string provider,
        string table,
        string indexName,
        string createSql,
        CancellationToken ct)
    {
        if (!await TableExistsAsync(connection, provider, table, ct))
        {
            return;
        }

        if (await IndexExistsAsync(connection, provider, table, indexName, ct))
        {
            return;
        }

        if (provider == "postgres")
        {
            createSql = createSql.Replace("CREATE INDEX ", "CREATE INDEX IF NOT EXISTS ", StringComparison.OrdinalIgnoreCase);
        }

        await ExecuteNonQueryAsync(connection, createSql, ct);
    }

    private static async Task<bool> TableExistsAsync(DbConnection connection, string provider, string table, CancellationToken ct)
    {
        var sql = provider switch
        {
            "sqlserver" => "SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = @table",
            "mysql" => "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = @table",
            _ => "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = @table"
        };

        var result = await ExecuteScalarAsync(connection, sql, new Dictionary<string, object> { ["@table"] = table }, ct);
        return Convert.ToInt32(result) > 0;
    }

    private static async Task<bool> ColumnExistsAsync(DbConnection connection, string provider, string table, string column, CancellationToken ct)
    {
        var sql = provider switch
        {
            "sqlserver" => "SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = @table AND COLUMN_NAME = @column",
            "mysql" => "SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = @table AND column_name = @column",
            _ => "SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = @table AND column_name = @column"
        };

        var result = await ExecuteScalarAsync(connection, sql, new Dictionary<string, object>
        {
            ["@table"] = table,
            ["@column"] = column
        }, ct);
        return Convert.ToInt32(result) > 0;
    }

    private static async Task<bool> IndexExistsAsync(DbConnection connection, string provider, string table, string indexName, CancellationToken ct)
    {
        var sql = provider switch
        {
            "sqlserver" => "SELECT COUNT(*) FROM sys.indexes WHERE name = @index AND object_id = OBJECT_ID(@table)",
            "mysql" => "SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = @table AND index_name = @index",
            _ => "SELECT COUNT(*) FROM pg_indexes WHERE lower(tablename) = lower(@table) AND lower(indexname) = lower(@index)"
        };

        var result = await ExecuteScalarAsync(connection, sql, new Dictionary<string, object>
        {
            ["@table"] = table,
            ["@index"] = indexName
        }, ct);
        return Convert.ToInt32(result) > 0;
    }

    private static async Task<object?> ExecuteScalarAsync(
        DbConnection connection,
        string sql,
        IDictionary<string, object> parameters,
        CancellationToken ct)
    {
        await using var command = connection.CreateCommand();
        command.CommandText = sql;
        foreach (var parameter in parameters)
        {
            var dbParameter = command.CreateParameter();
            dbParameter.ParameterName = parameter.Key;
            dbParameter.Value = parameter.Value;
            command.Parameters.Add(dbParameter);
        }
        return await command.ExecuteScalarAsync(ct);
    }

    private static async Task ExecuteNonQueryAsync(DbConnection connection, string sql, CancellationToken ct)
    {
        await using var command = connection.CreateCommand();
        command.CommandText = sql;
        await command.ExecuteNonQueryAsync(ct);
    }
}
