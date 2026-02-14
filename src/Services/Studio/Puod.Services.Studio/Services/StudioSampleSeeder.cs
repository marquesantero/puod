using System.Data;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Puod.Services.Studio.Data;
using Puod.Services.Studio.Models;

namespace Puod.Services.Studio.Services;

public class StudioSampleSeeder
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    private readonly StudioDbContext _dbContext;
    private readonly ILogger<StudioSampleSeeder> _logger;

    public StudioSampleSeeder(StudioDbContext dbContext, ILogger<StudioSampleSeeder> logger)
    {
        _dbContext = dbContext;
        _logger = logger;
    }

    public async Task SeedAsync(CancellationToken ct = default)
    {
        if (!await _dbContext.Database.CanConnectAsync(ct))
        {
            _logger.LogWarning("Studio seeding skipped: database is not reachable.");
            return;
        }

        var ownerUserId = await GetOwnerUserIdAsync(ct);
        if (!ownerUserId.HasValue)
        {
            _logger.LogWarning("Studio seeding skipped: no active users found.");
            return;
        }

        await EnsureAdfDataSourceDefaultsAsync(ct);

        var integrations = await GetIntegrationsAsync(ct);
        if (integrations.Count == 0)
        {
            _logger.LogInformation("Studio seeding: no Airflow, Databricks, ADF, or Synapse integrations found, seeding template library only.");
        }

        var existingCardSeeds = await GetExistingCardSeedsAsync(ct);
        var now = DateTime.UtcNow;
        var newCards = new List<StudioCard>();

        foreach (var integration in integrations)
        {
            if (!TryResolveScope(integration, out var scope, out var clientId, out var profileId))
            {
                _logger.LogWarning("Studio seeding skipped integration {IntegrationId}: unsupported owner type or missing scope ids.", integration.Id);
                continue;
            }

            foreach (var definition in BuildCardDefinitions(integration))
            {
                if (existingCardSeeds.Contains(definition.SeedKey))
                {
                    continue;
                }

                var card = new StudioCard
                {
                    OwnerUserId = ownerUserId.Value,
                    Scope = scope,
                    ClientId = clientId,
                    ProfileId = profileId,
                    Title = definition.Title,
                    Description = definition.Description,
                    CardType = definition.CardType,
                    LayoutType = definition.LayoutType,
                    Status = StudioCardStatus.Published,
                    IntegrationId = integration.Id,
                    Query = definition.Query,
                    FieldsJson = ToJson(definition.Fields),
                    StyleJson = ToJson(definition.Style),
                    LayoutJson = ToJson(definition.Layout),
                    RefreshPolicyJson = ToJson(definition.RefreshPolicy),
                    DataSourceJson = ToJson(definition.DataSource),
                    LastTestedAt = now,
                    LastTestSucceeded = true,
                    CreatedAt = now,
                    UpdatedAt = now
                };

                card.LastTestSignature = ComputeSignature(card);
                newCards.Add(card);
            }
        }

        if (newCards.Count > 0)
        {
            _dbContext.StudioCards.AddRange(newCards);
            await _dbContext.SaveChangesAsync(ct);
        }

        var cardsBySeed = await GetCardsBySeedKeyAsync(ct);
        var existingDashboardSeeds = await GetExistingDashboardSeedsAsync(ct);
        var newDashboards = new List<StudioDashboard>();
        var dashboardDefinitionsBySeed = new Dictionary<string, DashboardSeedDefinition>(StringComparer.OrdinalIgnoreCase);
        var newDashboardCards = new List<StudioDashboardCard>();

        foreach (var integration in integrations)
        {
            if (!TryResolveScope(integration, out var scope, out var clientId, out var profileId))
            {
                continue;
            }

            var dashboardDefinition = BuildDashboardDefinition(integration, cardsBySeed);
            if (dashboardDefinition == null || existingDashboardSeeds.Contains(dashboardDefinition.SeedKey))
            {
                continue;
            }

            var dashboard = new StudioDashboard
            {
                OwnerUserId = ownerUserId.Value,
                Scope = scope,
                ClientId = clientId,
                ProfileId = profileId,
                Name = dashboardDefinition.Name,
                Description = dashboardDefinition.Description,
                LayoutType = "grid",
                Status = StudioDashboardStatus.Published,
                LayoutJson = ToJson(dashboardDefinition.Layout),
                RefreshPolicyJson = ToJson(dashboardDefinition.RefreshPolicy),
                CreatedAt = now,
                UpdatedAt = now
            };

            newDashboards.Add(dashboard);
            dashboardDefinitionsBySeed[dashboardDefinition.SeedKey] = dashboardDefinition;
        }

        if (newDashboards.Count > 0)
        {
            _dbContext.StudioDashboards.AddRange(newDashboards);
            await _dbContext.SaveChangesAsync(ct);

            foreach (var dashboard in newDashboards)
            {
                var seedKey = ReadSeedKey(dashboard.LayoutJson);
                if (seedKey == null || !dashboardDefinitionsBySeed.TryGetValue(seedKey, out var definition))
                {
                    continue;
                }

                newDashboardCards.AddRange(definition.Cards.Select((card, index) => new StudioDashboardCard
                {
                    DashboardId = dashboard.Id,
                    CardId = card.CardId,
                    Title = card.Title,
                    Description = card.Description,
                    ShowTitle = card.ShowTitle,
                    ShowDescription = card.ShowDescription,
                    IntegrationId = definition.IntegrationId,
                    OrderIndex = index,
                    PositionX = card.PositionX,
                    PositionY = card.PositionY,
                    Width = card.Width,
                    Height = card.Height,
                    RefreshPolicyJson = ToJson(new { mode = card.RefreshMode, interval = card.RefreshInterval }),
                    DataSourceJson = card.DataSourceJson,
                    CreatedAt = now,
                    UpdatedAt = now
                }));
            }

            if (newDashboardCards.Count > 0)
            {
                _dbContext.StudioDashboardCards.AddRange(newDashboardCards);
                await _dbContext.SaveChangesAsync(ct);
            }
        }
    }

    private async Task<long?> GetOwnerUserIdAsync(CancellationToken ct)
    {
        var connection = _dbContext.Database.GetDbConnection();
        if (connection.State != ConnectionState.Open)
        {
            await connection.OpenAsync(ct);
        }

        await using var command = connection.CreateCommand();
        command.CommandText = """
            SELECT id
            FROM users
            WHERE NOT is_deleted AND email = 'puod_admin'
            ORDER BY created_at
            LIMIT 1;
            """;

        var result = await command.ExecuteScalarAsync(ct);
        if (result is long id)
        {
            return id;
        }

        command.CommandText = """
            SELECT id
            FROM users
            WHERE NOT is_deleted
            ORDER BY created_at
            LIMIT 1;
            """;

        result = await command.ExecuteScalarAsync(ct);
        if (result is long fallbackId)
        {
            return fallbackId;
        }

        if (result is int fallbackInt)
        {
            return fallbackInt;
        }

        return null;
    }

    private async Task<List<IntegrationSeed>> GetIntegrationsAsync(CancellationToken ct)
    {
        var connection = _dbContext.Database.GetDbConnection();
        if (connection.State != ConnectionState.Open)
        {
            await connection.OpenAsync(ct);
        }

        await using var command = connection.CreateCommand();
        command.CommandText = """
            SELECT id, type, owner_type, client_id, profile_id, name
            FROM integrations
            WHERE NOT is_deleted;
            """;

        var integrations = new List<IntegrationSeed>();
        await using var reader = await command.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
        {
            var rawType = reader["type"]?.ToString();
            var normalizedType = NormalizeIntegrationType(rawType);
            if (normalizedType is not ("Airflow" or "Databricks" or "AzureDataFactory" or "Synapse"))
            {
                continue;
            }

            var integrationId = (long)reader["id"];
            var seedBase = normalizedType switch
            {
                "Airflow" => "airflow-ops",
                "Databricks" => "databricks-ops",
                "AzureDataFactory" => "adf-ops",
                "Synapse" => "synapse-ops",
                _ => "ops"
            };

            integrations.Add(new IntegrationSeed(
                integrationId,
                normalizedType,
                reader["owner_type"]?.ToString(),
                reader["client_id"] as long?,
                reader["profile_id"] as long?,
                reader["name"]?.ToString() ?? normalizedType,
                $"{seedBase}-{integrationId}"));
        }

        return integrations;
    }

    private async Task<HashSet<string>> GetExistingCardSeedsAsync(CancellationToken ct)
    {
        var payloads = await _dbContext.StudioCards
            .AsNoTracking()
            .Where(card => !card.IsDeleted)
            .Select(card => card.DataSourceJson)
            .ToListAsync(ct);

        return payloads
            .Select(ReadSeedKey)
            .Where(seed => !string.IsNullOrWhiteSpace(seed))
            .Select(seed => seed!)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);
    }

    private async Task<HashSet<string>> GetExistingDashboardSeedsAsync(CancellationToken ct)
    {
        var payloads = await _dbContext.StudioDashboards
            .AsNoTracking()
            .Where(dashboard => !dashboard.IsDeleted)
            .Select(dashboard => dashboard.LayoutJson)
            .ToListAsync(ct);

        return payloads
            .Select(ReadSeedKey)
            .Where(seed => !string.IsNullOrWhiteSpace(seed))
            .Select(seed => seed!)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);
    }

    private async Task<Dictionary<string, StudioCardSeedResult>> GetCardsBySeedKeyAsync(CancellationToken ct)
    {
        var cards = await _dbContext.StudioCards
            .AsNoTracking()
            .Where(card => !card.IsDeleted)
            .Select(card => new { card.Id, card.DataSourceJson, card.Title, card.Description })
            .ToListAsync(ct);

        var results = new Dictionary<string, StudioCardSeedResult>(StringComparer.OrdinalIgnoreCase);
        foreach (var card in cards)
        {
            var seedKey = ReadSeedKey(card.DataSourceJson);
            if (string.IsNullOrWhiteSpace(seedKey))
            {
                continue;
            }

            results[seedKey] = new StudioCardSeedResult(card.Id, card.Title, card.Description, card.DataSourceJson);
        }

        return results;
    }

    private static bool TryResolveScope(
        IntegrationSeed integration,
        out StudioScope scope,
        out long? clientId,
        out long? profileId)
    {
        scope = StudioScope.Company;
        clientId = null;
        profileId = null;

        var normalized = NormalizeOwnerType(integration.OwnerType);
        if (normalized == "client")
        {
            if (!integration.ClientId.HasValue)
            {
                return false;
            }

            scope = StudioScope.Client;
            clientId = integration.ClientId;
            return true;
        }

        if (normalized == "company")
        {
            if (!integration.ProfileId.HasValue)
            {
                return false;
            }

            scope = StudioScope.Company;
            profileId = integration.ProfileId;
            return true;
        }

        return false;
    }

    private static string NormalizeOwnerType(string? ownerType)
    {
        if (string.IsNullOrWhiteSpace(ownerType))
        {
            return string.Empty;
        }

        var trimmed = ownerType.Trim();
        if (int.TryParse(trimmed, out var numeric))
        {
            return numeric switch
            {
                2 => "client",
                0 => "company",
                _ => "group"
            };
        }

        return trimmed.ToLowerInvariant();
    }

    private static string NormalizeIntegrationType(string? rawType)
    {
        if (string.IsNullOrWhiteSpace(rawType))
        {
            return string.Empty;
        }

        var trimmed = rawType.Trim();
        if (int.TryParse(trimmed, out var numeric))
        {
            return numeric switch
            {
                0 => "Databricks",
                1 => "Synapse",
                2 => "Airflow",
                3 => "AzureDataFactory",
                _ => trimmed
            };
        }

        if (trimmed.Equals("adf", StringComparison.OrdinalIgnoreCase))
        {
            return "AzureDataFactory";
        }

        if (trimmed.Equals("azuredatafactory", StringComparison.OrdinalIgnoreCase) ||
            trimmed.Equals("azure_data_factory", StringComparison.OrdinalIgnoreCase))
        {
            return "AzureDataFactory";
        }

        if (trimmed.Equals("synapse", StringComparison.OrdinalIgnoreCase))
        {
            return "Synapse";
        }

        if (trimmed.Length == 1)
        {
            return trimmed.ToUpperInvariant();
        }

        return char.ToUpperInvariant(trimmed[0]) + trimmed[1..].ToLowerInvariant();
    }

    private static IEnumerable<CardSeedDefinition> BuildCardDefinitions(IntegrationSeed integration)
    {
        return integration.Type switch
        {
            "Airflow" => BuildAirflowCards(integration),
            "Databricks" => BuildDatabricksCards(integration),
            "AzureDataFactory" => BuildAdfCards(integration),
            "Synapse" => BuildSynapseCards(integration),
            _ => Array.Empty<CardSeedDefinition>()
        };
    }

    private static IEnumerable<CardSeedDefinition> BuildAirflowCards(IntegrationSeed integration)
    {
        var baseStyle = new
        {
            background = "#f8fafc",
            text = "#0f172a",
            accent = "#0ea5e9",
            fontSize = "base",
            radius = "14px",
            shadow = "0 20px 45px rgba(15, 23, 42, 0.12)"
        };

        var refresh = new { mode = "Interval", interval = "5m" };
        var seedBase = integration.SeedKey;

        return new[]
        {
            new CardSeedDefinition(
                $"{seedBase}-pipeline-health",
                "Airflow - Pipeline Health Pulse",
                "Snapshot of run health across critical DAGs.",
                "kpi",
                "kpi",
                "dags/health?window=24h",
                new[]
                {
                    new { key = "success_rate", label = "Success rate", format = "percent" },
                    new { key = "failed_dags", label = "Failed DAGs", format = "number" },
                    new { key = "running_now", label = "Running now", format = "number" }
                },
                baseStyle,
                new { density = "comfortable" },
                refresh,
                new
                {
                    seedKey = $"{seedBase}-pipeline-health",
                    integrationType = "airflow",
                    endpoint = "/api/v1/dags/health",
                    method = "GET"
                }),
            new CardSeedDefinition(
                $"{seedBase}-scheduler-lag",
                "Airflow - Scheduler Lag",
                "Measures scheduling delay and backlog.",
                "kpi",
                "kpi",
                "scheduler/lag?window=6h",
                new[]
                {
                    new { key = "avg_lag", label = "Avg lag (min)", format = "number" },
                    new { key = "max_lag", label = "Max lag (min)", format = "number" },
                    new { key = "queued_tasks", label = "Queued tasks", format = "number" }
                },
                baseStyle,
                new { density = "compact" },
                refresh,
                new
                {
                    seedKey = $"{seedBase}-scheduler-lag",
                    integrationType = "airflow",
                    endpoint = "/api/v1/scheduler/lag",
                    method = "GET"
                }),
            new CardSeedDefinition(
                $"{seedBase}-recent-runs",
                "Airflow - Recent DAG Runs",
                "Latest executions with status and duration.",
                "table",
                "grid",
                "dagRuns?limit=25&sort=-execution_date",
                new[]
                {
                    new { key = "dag_id", label = "DAG", format = "text" },
                    new { key = "run_id", label = "Run ID", format = "text" },
                    new { key = "state", label = "State", format = "status" },
                    new { key = "duration", label = "Duration (min)", format = "number" }
                },
                baseStyle,
                new { density = "compact" },
                refresh,
                new
                {
                    seedKey = $"{seedBase}-recent-runs",
                    integrationType = "airflow",
                    endpoint = "/api/v1/dags/{dagId}/dagRuns",
                    method = "GET"
                }),
            new CardSeedDefinition(
                $"{seedBase}-sla-risk",
                "Airflow - SLA Risk",
                "Tasks breaching SLA windows.",
                "table",
                "grid",
                "sla/breaches?window=24h",
                new[]
                {
                    new { key = "dag_id", label = "DAG", format = "text" },
                    new { key = "task_id", label = "Task", format = "text" },
                    new { key = "minutes_overdue", label = "Overdue (min)", format = "number" },
                    new { key = "owner", label = "Owner", format = "text" }
                },
                baseStyle,
                new { density = "comfortable" },
                refresh,
                new
                {
                    seedKey = $"{seedBase}-sla-risk",
                    integrationType = "airflow",
                    endpoint = "/api/v1/monitoring/slas",
                    method = "GET"
                }),
            new CardSeedDefinition(
                $"{seedBase}-backfill-timeline",
                "Airflow - Backfill Timeline",
                "Backfill volume by day.",
                "timeline",
                "timeline",
                "backfills/timeline?window=14d",
                new[]
                {
                    new { key = "date", label = "Date", format = "date" },
                    new { key = "backfills", label = "Backfills", format = "number" },
                    new { key = "success_rate", label = "Success rate", format = "percent" }
                },
                baseStyle,
                new { density = "comfortable" },
                refresh,
                new
                {
                    seedKey = $"{seedBase}-backfill-timeline",
                    integrationType = "airflow",
                    endpoint = "/api/v1/backfills/timeline",
                    method = "GET"
                }),
            new CardSeedDefinition(
                $"{seedBase}-dag-runs-history",
                "Airflow - DAG Runs (History)",
                "Latest run per DAG with expandable history and tasks.",
                "table",
                "grid",
                "dagRuns?limit=100&order_by=-execution_date",
                new[]
                {
                    new { key = "dag_id", label = "DAG", format = "text" },
                    new { key = "dag_run_id", label = "Run", format = "text" },
                    new { key = "state", label = "State", format = "status" },
                    new { key = "start_date", label = "Start", format = "date" },
                    new { key = "end_date", label = "End", format = "date" }
                },
                baseStyle,
                new { density = "comfortable" },
                refresh,
                new
                {
                    seedKey = $"{seedBase}-dag-runs-history",
                    integrationType = "airflow",
                    dagIds = Array.Empty<string>(),
                    limit = 100,
                    orderBy = "-execution_date"
                }),
            new CardSeedDefinition(
                $"{seedBase}-dag-status-map",
                "Airflow - Status Map",
                "Current status snapshot across selected DAGs.",
                "table",
                "grid",
                "dagRuns?limit=50&order_by=-execution_date",
                new[]
                {
                    new { key = "dag_id", label = "DAG", format = "text" },
                    new { key = "state", label = "State", format = "status" },
                    new { key = "start_date", label = "Start", format = "date" },
                    new { key = "end_date", label = "End", format = "date" }
                },
                baseStyle,
                new { density = "compact" },
                refresh,
                new
                {
                    seedKey = $"{seedBase}-dag-status-map",
                    integrationType = "airflow",
                    dagIds = Array.Empty<string>(),
                    limit = 50,
                    orderBy = "-execution_date"
                }),
            new CardSeedDefinition(
                $"{seedBase}-dag-failures",
                "Airflow - Failed Runs",
                "Failure-focused view of recent DAG runs.",
                "table",
                "grid",
                "dagRuns?limit=100&order_by=-execution_date",
                new[]
                {
                    new { key = "dag_id", label = "DAG", format = "text" },
                    new { key = "dag_run_id", label = "Run", format = "text" },
                    new { key = "state", label = "State", format = "status" },
                    new { key = "start_date", label = "Start", format = "date" },
                    new { key = "end_date", label = "End", format = "date" }
                },
                baseStyle,
                new { density = "comfortable" },
                refresh,
                new
                {
                    seedKey = $"{seedBase}-dag-failures",
                    integrationType = "airflow",
                    dagIds = Array.Empty<string>(),
                    state = new[] { "failed" },
                    limit = 100,
                    orderBy = "-execution_date"
                }),
            new CardSeedDefinition(
                $"{seedBase}-dag-running",
                "Airflow - Running Now",
                "DAG runs currently in progress.",
                "table",
                "grid",
                "dagRuns?limit=100&order_by=-execution_date",
                new[]
                {
                    new { key = "dag_id", label = "DAG", format = "text" },
                    new { key = "dag_run_id", label = "Run", format = "text" },
                    new { key = "state", label = "State", format = "status" },
                    new { key = "start_date", label = "Start", format = "date" }
                },
                baseStyle,
                new { density = "compact" },
                refresh,
                new
                {
                    seedKey = $"{seedBase}-dag-running",
                    integrationType = "airflow",
                    dagIds = Array.Empty<string>(),
                    state = new[] { "running" },
                    limit = 100,
                    orderBy = "-execution_date"
                }),
            new CardSeedDefinition(
                $"{seedBase}-dag-performance",
                "Airflow - Run Durations",
                "Run durations for recent DAG executions.",
                "table",
                "grid",
                "dagRuns?limit=100&order_by=-execution_date",
                new[]
                {
                    new { key = "dag_id", label = "DAG", format = "text" },
                    new { key = "dag_run_id", label = "Run", format = "text" },
                    new { key = "state", label = "State", format = "status" },
                    new { key = "start_date", label = "Start", format = "date" },
                    new { key = "end_date", label = "End", format = "date" }
                },
                baseStyle,
                new { density = "comfortable" },
                refresh,
                new
                {
                    seedKey = $"{seedBase}-dag-performance",
                    integrationType = "airflow",
                    dagIds = Array.Empty<string>(),
                    limit = 100,
                    orderBy = "-execution_date"
                })
        };
    }

    private static IEnumerable<CardSeedDefinition> BuildDatabricksCards(IntegrationSeed integration)
    {
        var baseStyle = new
        {
            background = "#fff7ed",
            text = "#431407",
            accent = "#f97316",
            fontSize = "base",
            radius = "14px",
            shadow = "0 20px 45px rgba(124, 45, 18, 0.18)"
        };

        var refresh = new { mode = "Interval", interval = "5m" };
        var seedBase = integration.SeedKey;

        return new[]
        {
            new CardSeedDefinition(
                $"{seedBase}-job-throughput",
                "Databricks - Job Throughput",
                "Job volume and failure rate snapshot.",
                "kpi",
                "kpi",
                "jobs/throughput?window=24h",
                new[]
                {
                    new { key = "jobs_per_hour", label = "Jobs/hour", format = "number" },
                    new { key = "avg_duration", label = "Avg duration (min)", format = "number" },
                    new { key = "failed_runs", label = "Failed runs", format = "number" }
                },
                baseStyle,
                new { density = "comfortable" },
                refresh,
                new
                {
                    seedKey = $"{seedBase}-job-throughput",
                    integrationType = "databricks",
                    endpoint = "/api/2.1/jobs/runs/list",
                    method = "GET"
                }),
            new CardSeedDefinition(
                $"{seedBase}-cost-forecast",
                "Databricks - Cost Forecast",
                "Projected spend based on last 7 days.",
                "kpi",
                "kpi",
                "cost/forecast?window=7d",
                new[]
                {
                    new { key = "daily_avg", label = "Daily avg ($)", format = "currency" },
                    new { key = "forecast_30d", label = "30d forecast ($)", format = "currency" },
                    new { key = "delta_week", label = "WoW change", format = "percent" }
                },
                baseStyle,
                new { density = "compact" },
                refresh,
                new
                {
                    seedKey = $"{seedBase}-cost-forecast",
                    integrationType = "databricks",
                    endpoint = "/api/2.0/workspace/costs",
                    method = "GET"
                }),
            new CardSeedDefinition(
                $"{seedBase}-cluster-inventory",
                "Databricks - Cluster Inventory",
                "Live clusters with runtime and owners.",
                "table",
                "grid",
                "clusters/list",
                new[]
                {
                    new { key = "cluster_name", label = "Cluster", format = "text" },
                    new { key = "state", label = "State", format = "status" },
                    new { key = "node_type", label = "Node type", format = "text" },
                    new { key = "owner", label = "Owner", format = "text" }
                },
                baseStyle,
                new { density = "compact" },
                refresh,
                new
                {
                    seedKey = $"{seedBase}-cluster-inventory",
                    integrationType = "databricks",
                    endpoint = "/api/2.0/clusters/list",
                    method = "GET"
                }),
            new CardSeedDefinition(
                $"{seedBase}-notebook-trend",
                "Databricks - Notebook Success Trend",
                "Run success rate by day.",
                "timeline",
                "timeline",
                "notebooks/trend?window=14d",
                new[]
                {
                    new { key = "date", label = "Date", format = "date" },
                    new { key = "success_rate", label = "Success rate", format = "percent" },
                    new { key = "runs", label = "Runs", format = "number" }
                },
                baseStyle,
                new { density = "comfortable" },
                refresh,
                new
                {
                    seedKey = $"{seedBase}-notebook-trend",
                    integrationType = "databricks",
                    endpoint = "/api/2.1/jobs/runs/list",
                    method = "GET"
                }),
            new CardSeedDefinition(
                $"{seedBase}-delta-quality",
                "Databricks - Delta Quality Gate",
                "Delta tables failing quality checks.",
                "table",
                "grid",
                "delta/quality?window=24h",
                new[]
                {
                    new { key = "table", label = "Table", format = "text" },
                    new { key = "check", label = "Check", format = "text" },
                    new { key = "status", label = "Status", format = "status" },
                    new { key = "failures", label = "Failures", format = "number" }
                },
                baseStyle,
                new { density = "comfortable" },
                refresh,
                new
                {
                    seedKey = $"{seedBase}-delta-quality",
                    integrationType = "databricks",
                    endpoint = "/api/2.1/unity-catalog/quality",
                    method = "GET"
                }),
            new CardSeedDefinition(
                $"{seedBase}-job-runs",
                "Databricks - Job Runs (Latest)",
                "Latest job runs with status and duration.",
                "table",
                "grid",
                "jobs/runs/list",
                new[]
                {
                    new { key = "job_id", label = "Job ID", format = "text" },
                    new { key = "run_id", label = "Run ID", format = "text" },
                    new { key = "state", label = "State", format = "status" },
                    new { key = "start_time", label = "Start", format = "date" },
                    new { key = "end_time", label = "End", format = "date" }
                },
                baseStyle,
                new { density = "compact" },
                refresh,
                new
                {
                    seedKey = $"{seedBase}-job-runs",
                    integrationType = "databricks",
                    jobIds = Array.Empty<string>(),
                    limit = 100
                }),
            new CardSeedDefinition(
                $"{seedBase}-job-failures",
                "Databricks - Failed Runs",
                "Failure-focused view of job runs.",
                "table",
                "grid",
                "jobs/runs/list",
                new[]
                {
                    new { key = "job_id", label = "Job ID", format = "text" },
                    new { key = "run_id", label = "Run ID", format = "text" },
                    new { key = "state", label = "State", format = "status" },
                    new { key = "start_time", label = "Start", format = "date" }
                },
                baseStyle,
                new { density = "compact" },
                refresh,
                new
                {
                    seedKey = $"{seedBase}-job-failures",
                    integrationType = "databricks",
                    jobIds = Array.Empty<string>(),
                    states = new[] { "FAILED", "ERROR" },
                    limit = 100
                }),
            new CardSeedDefinition(
                $"{seedBase}-job-status-map",
                "Databricks - Status Map",
                "Status snapshot across selected jobs.",
                "table",
                "grid",
                "jobs/runs/list",
                new[]
                {
                    new { key = "job_id", label = "Job ID", format = "text" },
                    new { key = "state", label = "State", format = "status" },
                    new { key = "start_time", label = "Start", format = "date" }
                },
                baseStyle,
                new { density = "compact" },
                refresh,
                new
                {
                    seedKey = $"{seedBase}-job-status-map",
                    integrationType = "databricks",
                    jobIds = Array.Empty<string>(),
                    limit = 50
                }),
            new CardSeedDefinition(
                $"{seedBase}-job-performance",
                "Databricks - Run Durations",
                "Duration spotlight for recent job runs.",
                "table",
                "grid",
                "jobs/runs/list",
                new[]
                {
                    new { key = "job_id", label = "Job ID", format = "text" },
                    new { key = "run_id", label = "Run ID", format = "text" },
                    new { key = "state", label = "State", format = "status" },
                    new { key = "start_time", label = "Start", format = "date" },
                    new { key = "end_time", label = "End", format = "date" }
                },
                baseStyle,
                new { density = "comfortable" },
                refresh,
                new
                {
                    seedKey = $"{seedBase}-job-performance",
                    integrationType = "databricks",
                    jobIds = Array.Empty<string>(),
                    limit = 100
                }),
            new CardSeedDefinition(
                $"{seedBase}-cluster-status",
                "Databricks - Cluster Status",
                "Cluster states and ownership snapshot.",
                "table",
                "grid",
                "clusters/list",
                new[]
                {
                    new { key = "cluster_id", label = "Cluster ID", format = "text" },
                    new { key = "cluster_name", label = "Cluster", format = "text" },
                    new { key = "state", label = "State", format = "status" },
                    new { key = "owner", label = "Owner", format = "text" }
                },
                baseStyle,
                new { density = "compact" },
                refresh,
                new
                {
                    seedKey = $"{seedBase}-cluster-status",
                    integrationType = "databricks",
                    clusterIds = Array.Empty<string>(),
                    limit = 100
                })
        };
    }

    private static IEnumerable<CardSeedDefinition> BuildAdfCards(IntegrationSeed integration)
    {
        var baseStyle = new
        {
            background = "#eef2ff",
            text = "#1e1b4b",
            accent = "#2563eb",
            fontSize = "base",
            radius = "14px",
            shadow = "0 20px 45px rgba(30, 27, 75, 0.12)"
        };

        var refresh = new { mode = "Interval", interval = "10m" };
        var seedBase = integration.SeedKey;

        return new[]
        {
            new CardSeedDefinition(
                $"{seedBase}-pipeline-runs",
                "ADF - Pipeline Runs (Latest)",
                "Latest pipeline runs with status and duration.",
                "table",
                "grid",
                "pipelineRuns",
                new[]
                {
                    new { key = "pipeline_name", label = "Pipeline", format = "text" },
                    new { key = "run_id", label = "Run ID", format = "text" },
                    new { key = "status", label = "Status", format = "status" },
                    new { key = "run_start", label = "Start", format = "date" },
                    new { key = "run_end", label = "End", format = "date" }
                },
                baseStyle,
                new { density = "comfortable" },
                refresh,
                new
                {
                    seedKey = $"{seedBase}-pipeline-runs",
                    endpoint = "/queryPipelineRuns?api-version=2018-06-01",
                    method = "POST",
                    integrationType = "adf",
                    pipelineNames = Array.Empty<string>(),
                    limit = 100
                }),
            new CardSeedDefinition(
                $"{seedBase}-pipeline-failures",
                "ADF - Failed Runs",
                "Failure-focused view of pipeline runs.",
                "table",
                "grid",
                "pipelineRuns",
                new[]
                {
                    new { key = "pipeline_name", label = "Pipeline", format = "text" },
                    new { key = "run_id", label = "Run ID", format = "text" },
                    new { key = "status", label = "Status", format = "status" },
                    new { key = "run_start", label = "Start", format = "date" }
                },
                baseStyle,
                new { density = "compact" },
                refresh,
                new
                {
                    seedKey = $"{seedBase}-pipeline-failures",
                    endpoint = "/queryPipelineRuns?api-version=2018-06-01",
                    method = "POST",
                    integrationType = "adf",
                    pipelineNames = Array.Empty<string>(),
                    status = new[] { "Failed" },
                    limit = 100
                }),
            new CardSeedDefinition(
                $"{seedBase}-pipeline-status-map",
                "ADF - Status Map",
                "Status snapshot across selected pipelines.",
                "table",
                "grid",
                "pipelineRuns",
                new[]
                {
                    new { key = "pipeline_name", label = "Pipeline", format = "text" },
                    new { key = "status", label = "Status", format = "status" },
                    new { key = "run_start", label = "Start", format = "date" }
                },
                baseStyle,
                new { density = "compact" },
                refresh,
                new
                {
                    seedKey = $"{seedBase}-pipeline-status-map",
                    endpoint = "/queryPipelineRuns?api-version=2018-06-01",
                    method = "POST",
                    integrationType = "adf",
                    pipelineNames = Array.Empty<string>(),
                    limit = 50
                }),
            new CardSeedDefinition(
                $"{seedBase}-pipeline-performance",
                "ADF - Run Durations",
                "Duration spotlight for recent pipeline runs.",
                "table",
                "grid",
                "pipelineRuns",
                new[]
                {
                    new { key = "pipeline_name", label = "Pipeline", format = "text" },
                    new { key = "run_id", label = "Run ID", format = "text" },
                    new { key = "status", label = "Status", format = "status" },
                    new { key = "run_start", label = "Start", format = "date" },
                    new { key = "run_end", label = "End", format = "date" }
                },
                baseStyle,
                new { density = "comfortable" },
                refresh,
                new
                {
                    seedKey = $"{seedBase}-pipeline-performance",
                    endpoint = "/queryPipelineRuns?api-version=2018-06-01",
                    method = "POST",
                    integrationType = "adf",
                    pipelineNames = Array.Empty<string>(),
                    limit = 100
                })
        };
    }

    private async Task EnsureAdfDataSourceDefaultsAsync(CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        var updatedCards = 0;
        var updatedDashboardCards = 0;

        var cards = await _dbContext.StudioCards
            .Where(card => !card.IsDeleted && card.DataSourceJson != null)
            .ToListAsync(ct);

        foreach (var card in cards)
        {
            var seedKey = ReadSeedKey(card.DataSourceJson);
            var updatedJson = EnsureAdfDefaults(card.DataSourceJson, seedKey);
            if (updatedJson != card.DataSourceJson)
            {
                card.DataSourceJson = updatedJson;
                card.UpdatedAt = now;
                updatedCards++;
            }
        }

        var dashboardCards = await _dbContext.StudioDashboardCards
            .Where(card => card.DataSourceJson != null)
            .ToListAsync(ct);

        foreach (var card in dashboardCards)
        {
            var updatedJson = EnsureAdfDefaults(card.DataSourceJson, null);
            if (updatedJson != card.DataSourceJson)
            {
                card.DataSourceJson = updatedJson;
                card.UpdatedAt = now;
                updatedDashboardCards++;
            }
        }

        if (updatedCards + updatedDashboardCards > 0)
        {
            _logger.LogInformation(
                "Studio seeding: normalized ADF dataSourceJson for {CardCount} cards and {DashboardCardCount} dashboard cards.",
                updatedCards,
                updatedDashboardCards);
            await _dbContext.SaveChangesAsync(ct);
        }
    }

    private static string? EnsureAdfDefaults(string? dataSourceJson, string? seedKey)
    {
        if (string.IsNullOrWhiteSpace(dataSourceJson))
        {
            return dataSourceJson;
        }

        Dictionary<string, object?>? payload;
        try
        {
            payload = JsonSerializer.Deserialize<Dictionary<string, object?>>(dataSourceJson, JsonOptions);
        }
        catch
        {
            return dataSourceJson;
        }

        if (payload == null || !TryGetIntegrationType(payload, out var integrationType))
        {
            return dataSourceJson;
        }

        if (!IsAdfIntegrationType(integrationType))
        {
            return dataSourceJson;
        }

        var updated = false;

        if (!HasKey(payload, "endpoint"))
        {
            payload["endpoint"] = "/queryPipelineRuns?api-version=2018-06-01";
            updated = true;
        }

        if (!HasKey(payload, "method"))
        {
            payload["method"] = "POST";
            updated = true;
        }

        if (!string.IsNullOrWhiteSpace(seedKey) && !HasKey(payload, "seedKey"))
        {
            payload["seedKey"] = seedKey;
            updated = true;
        }

        return updated ? JsonSerializer.Serialize(payload, JsonOptions) : dataSourceJson;
    }

    private static bool TryGetIntegrationType(IReadOnlyDictionary<string, object?> payload, out string? integrationType)
    {
        integrationType = null;
        if (!payload.TryGetValue("integrationType", out var value))
        {
            return false;
        }

        integrationType = value switch
        {
            JsonElement json when json.ValueKind == JsonValueKind.String => json.GetString(),
            string text => text,
            _ => value?.ToString()
        };

        return !string.IsNullOrWhiteSpace(integrationType);
    }

    private static bool IsAdfIntegrationType(string? integrationType)
    {
        return string.Equals(integrationType, "adf", StringComparison.OrdinalIgnoreCase)
            || string.Equals(integrationType, "azuredatafactory", StringComparison.OrdinalIgnoreCase)
            || string.Equals(integrationType, "AzureDataFactory", StringComparison.OrdinalIgnoreCase);
    }

    private static bool HasKey(IReadOnlyDictionary<string, object?> payload, string key)
    {
        return payload.Keys.Any(existingKey => string.Equals(existingKey, key, StringComparison.OrdinalIgnoreCase));
    }

    private static IEnumerable<CardSeedDefinition> BuildSynapseCards(IntegrationSeed integration)
    {
        var baseStyle = new
        {
            background = "#f0f9ff",
            text = "#0f172a",
            accent = "#0284c7",
            fontSize = "base",
            radius = "14px",
            shadow = "0 20px 45px rgba(2, 132, 199, 0.16)"
        };

        var refresh = new { mode = "Interval", interval = "10m" };
        var seedBase = integration.SeedKey;

        return new[]
        {
            new CardSeedDefinition(
                $"{seedBase}-recent-requests",
                "Synapse - Recent Requests",
                "Latest SQL requests with status and duration.",
                "table",
                "grid",
                "SELECT TOP 25 request_id, status, submit_time, start_time, end_time, total_elapsed_time FROM sys.dm_pdw_exec_requests ORDER BY submit_time DESC;",
                new[]
                {
                    new { key = "request_id", label = "Request", format = "text" },
                    new { key = "status", label = "Status", format = "status" },
                    new { key = "submit_time", label = "Submitted", format = "date" },
                    new { key = "total_elapsed_time", label = "Elapsed (ms)", format = "number" }
                },
                baseStyle,
                new { density = "comfortable" },
                refresh,
                new
                {
                    seedKey = $"{seedBase}-recent-requests",
                    integrationType = "synapse",
                    limit = 25
                }),
            new CardSeedDefinition(
                $"{seedBase}-running-requests",
                "Synapse - Running Requests",
                "Queries currently executing or queued.",
                "table",
                "grid",
                "SELECT TOP 25 request_id, status, submit_time, start_time, total_elapsed_time FROM sys.dm_pdw_exec_requests WHERE status IN ('Running','Submitted','Queued') ORDER BY submit_time DESC;",
                new[]
                {
                    new { key = "request_id", label = "Request", format = "text" },
                    new { key = "status", label = "Status", format = "status" },
                    new { key = "submit_time", label = "Submitted", format = "date" },
                    new { key = "total_elapsed_time", label = "Elapsed (ms)", format = "number" }
                },
                baseStyle,
                new { density = "compact" },
                refresh,
                new
                {
                    seedKey = $"{seedBase}-running-requests",
                    integrationType = "synapse",
                    limit = 25
                }),
            new CardSeedDefinition(
                $"{seedBase}-failed-requests",
                "Synapse - Failed Requests",
                "Recent failed or cancelled requests.",
                "table",
                "grid",
                "SELECT TOP 25 request_id, status, submit_time, start_time, end_time, total_elapsed_time FROM sys.dm_pdw_exec_requests WHERE status IN ('Failed','Cancelled') ORDER BY submit_time DESC;",
                new[]
                {
                    new { key = "request_id", label = "Request", format = "text" },
                    new { key = "status", label = "Status", format = "status" },
                    new { key = "submit_time", label = "Submitted", format = "date" },
                    new { key = "total_elapsed_time", label = "Elapsed (ms)", format = "number" }
                },
                baseStyle,
                new { density = "compact" },
                refresh,
                new
                {
                    seedKey = $"{seedBase}-failed-requests",
                    integrationType = "synapse",
                    limit = 25
                })
        };
    }

    private static DashboardSeedDefinition? BuildDashboardDefinition(
        IntegrationSeed integration,
        IReadOnlyDictionary<string, StudioCardSeedResult> cardsBySeed)
    {
        if (integration.Type == "Airflow")
        {
            var definition = BuildAirflowDashboard(integration, cardsBySeed);
            return definition.Cards.Count == 0 ? null : definition;
        }

        if (integration.Type == "Databricks")
        {
            var definition = BuildDatabricksDashboard(integration, cardsBySeed);
            return definition.Cards.Count == 0 ? null : definition;
        }

        return null;
    }

    private static DashboardSeedDefinition BuildAirflowDashboard(
        IntegrationSeed integration,
        IReadOnlyDictionary<string, StudioCardSeedResult> cardsBySeed)
    {
        var layout = new
        {
            seedKey = integration.SeedKey,
            layout = new
            {
                columns = "12",
                gap = "16",
                rowHeight = "120",
                cardPadding = "16",
                headerStyle = "expanded",
                backgroundPattern = "dots",
                showFilters = true,
                showLegend = true
            },
            theme = new
            {
                background = "#f1f5f9",
                text = "#0f172a",
                accent = "#0ea5e9",
                fontSize = "base",
                radius = "18px",
                shadow = "0 30px 60px rgba(15, 23, 42, 0.12)"
            }
        };

        var cards = new[]
        {
            BuildDashboardCard(cardsBySeed, $"{integration.SeedKey}-pipeline-health", 0, 0, 4, 2),
            BuildDashboardCard(cardsBySeed, $"{integration.SeedKey}-scheduler-lag", 4, 0, 4, 2),
            BuildDashboardCard(cardsBySeed, $"{integration.SeedKey}-sla-risk", 8, 0, 4, 2),
            BuildDashboardCard(cardsBySeed, $"{integration.SeedKey}-recent-runs", 0, 2, 12, 3),
            BuildDashboardCard(cardsBySeed, $"{integration.SeedKey}-backfill-timeline", 0, 5, 12, 3)
        }.Where(card => card != null).Select(card => card!).ToList();

        return new DashboardSeedDefinition(
            integration.SeedKey,
            integration.Id,
            "Airflow Operations",
            "Operational overview for DAG stability and throughput.",
            layout,
            new { mode = "Interval", interval = "5m" },
            cards);
    }

    private static DashboardSeedDefinition BuildDatabricksDashboard(
        IntegrationSeed integration,
        IReadOnlyDictionary<string, StudioCardSeedResult> cardsBySeed)
    {
        var layout = new
        {
            seedKey = integration.SeedKey,
            layout = new
            {
                columns = "12",
                gap = "16",
                rowHeight = "120",
                cardPadding = "16",
                headerStyle = "expanded",
                backgroundPattern = "grid",
                showFilters = true,
                showLegend = true
            },
            theme = new
            {
                background = "#fff7ed",
                text = "#431407",
                accent = "#f97316",
                fontSize = "base",
                radius = "18px",
                shadow = "0 30px 60px rgba(124, 45, 18, 0.18)"
            }
        };

        var cards = new[]
        {
            BuildDashboardCard(cardsBySeed, $"{integration.SeedKey}-job-throughput", 0, 0, 4, 2),
            BuildDashboardCard(cardsBySeed, $"{integration.SeedKey}-cost-forecast", 4, 0, 4, 2),
            BuildDashboardCard(cardsBySeed, $"{integration.SeedKey}-delta-quality", 8, 0, 4, 2),
            BuildDashboardCard(cardsBySeed, $"{integration.SeedKey}-cluster-inventory", 0, 2, 12, 3),
            BuildDashboardCard(cardsBySeed, $"{integration.SeedKey}-notebook-trend", 0, 5, 12, 3)
        }.Where(card => card != null).Select(card => card!).ToList();

        return new DashboardSeedDefinition(
            integration.SeedKey,
            integration.Id,
            "Databricks Command Center",
            "Performance, cost, and quality signals for Databricks workloads.",
            layout,
            new { mode = "Interval", interval = "5m" },
            cards);
    }

    private static DashboardCardSeed? BuildDashboardCard(
        IReadOnlyDictionary<string, StudioCardSeedResult> cardsBySeed,
        string seedKey,
        int x,
        int y,
        int width,
        int height)
    {
        if (!cardsBySeed.TryGetValue(seedKey, out var card))
        {
            return null;
        }

        return new DashboardCardSeed(
            card.Id,
            x,
            y,
            width,
            height,
            card.Title,
            card.Description,
            true,
            true,
            "Inherit",
            "5m",
            card.DataSourceJson);
    }

    private static string ToJson(object value)
    {
        return JsonSerializer.Serialize(value, JsonOptions);
    }

    private static string? ReadSeedKey(string? json)
    {
        if (string.IsNullOrWhiteSpace(json))
        {
            return null;
        }

        try
        {
            using var doc = JsonDocument.Parse(json);
            if (doc.RootElement.TryGetProperty("seedKey", out var seedKey) && seedKey.ValueKind == JsonValueKind.String)
            {
                return seedKey.GetString();
            }
        }
        catch
        {
            return null;
        }

        return null;
    }

    private static string ComputeSignature(StudioCard card)
    {
        var payload = new
        {
            integrationId = card.IntegrationId,
            query = card.Query,
            cardType = card.CardType,
            layoutType = card.LayoutType,
            fieldsJson = card.FieldsJson,
            styleJson = card.StyleJson,
            layoutJson = card.LayoutJson,
            refreshPolicyJson = card.RefreshPolicyJson,
            dataSourceJson = card.DataSourceJson
        };

        return StudioHashService.ComputeSignature(payload);
    }

    private sealed record IntegrationSeed(
        long Id,
        string Type,
        string? OwnerType,
        long? ClientId,
        long? ProfileId,
        string Name,
        string SeedKey);

    private sealed record CardSeedDefinition(
        string SeedKey,
        string Title,
        string Description,
        string CardType,
        string LayoutType,
        string Query,
        object Fields,
        object Style,
        object Layout,
        object RefreshPolicy,
        object DataSource);

    private sealed record StudioCardSeedResult(long Id, string Title, string? Description, string? DataSourceJson);

    private sealed record DashboardSeedDefinition(
        string SeedKey,
        long IntegrationId,
        string Name,
        string Description,
        object Layout,
        object RefreshPolicy,
        List<DashboardCardSeed> Cards);

    private sealed record DashboardCardSeed(
        long CardId,
        int PositionX,
        int PositionY,
        int Width,
        int Height,
        string Title,
        string? Description,
        bool ShowTitle,
        bool ShowDescription,
        string RefreshMode,
        string RefreshInterval,
        string? DataSourceJson);
}
