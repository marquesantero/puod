using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Microsoft.Data.SqlClient;
using MySqlConnector;
using Npgsql;
using Microsoft.IdentityModel.Tokens;
using Puod.Services.User.Data;
using Puod.Services.User.DTOs;
using Puod.Services.User.Models;
using Puod.Services.User.Authorization;
using Puod.Services.User.Configuration;
using Puod.Services.User.Services;

var builder = WebApplication.CreateBuilder(args);

const string PostgresMigrationsAssembly = "Puod.Services.User.Migrations.Postgres";
const string SqlServerMigrationsAssembly = "Puod.Services.User.Migrations.SqlServer";
const string MySqlMigrationsAssembly = "Puod.Services.User.Migrations.MySql";

var bootstrapPath = Path.Combine(builder.Environment.ContentRootPath, "config", "bootstrap.database.json");
builder.Configuration.AddJsonFile(bootstrapPath, optional: true, reloadOnChange: true);

var bootstrapStore = new BootstrapDatabaseStore(bootstrapPath);

builder.Services.AddSingleton(bootstrapStore);

var jwtSettings = builder.Configuration.GetSection("JwtSettings");
builder.Services.Configure<JwtSettings>(jwtSettings);

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuerSigningKey = true,
        IssuerSigningKey = new SymmetricSecurityKey(
            Encoding.UTF8.GetBytes(jwtSettings["Secret"] ?? throw new InvalidOperationException("JWT Secret not configured"))),
        ValidateIssuer = true,
        ValidIssuer = jwtSettings["Issuer"],
        ValidateAudience = true,
        ValidAudience = jwtSettings["Audience"],
        ValidateLifetime = true,
        ClockSkew = TimeSpan.Zero
    };
});

builder.Services.AddScoped<IJwtTokenService, JwtTokenService>();
builder.Services.AddHttpContextAccessor();
builder.Services.AddHttpClient();
builder.Services.AddScoped<ICurrentUserProvider, CurrentUserProvider>();
builder.Services.AddSingleton<BootstrapRefreshTokenStore>();
builder.Services.AddSingleton<BootstrapConnectionTester>();
builder.Services.AddSingleton<DockerComposeService>();
builder.Services.AddSingleton<DatabaseReadinessChecker>();
builder.Services.AddSingleton<RoleLinkSchemaEnsurer>();
builder.Services.AddHostedService<RoleLinkSchemaSyncHostedService>();
builder.Services.Configure<SetupDefaults>(builder.Configuration.GetSection("SetupDefaults"));

builder.Services.AddScoped<AuthService>();
builder.Services.AddScoped<BootstrapAuthService>();
builder.Services.AddScoped<BootstrapSetupService>();
builder.Services.AddScoped<SetupService>();
builder.Services.AddScoped<IAuthService, AuthServiceRouter>();
builder.Services.AddScoped<ISetupService, SetupServiceRouter>();
builder.Services.AddScoped<BootstrapSeeder>();

// Client Services
builder.Services.AddScoped<IClientService, ClientService>();
builder.Services.AddScoped<IRoleHierarchyService, RoleHierarchyService>();
builder.Services.AddScoped<IAccessControlService, AccessControlService>();

// Identity Providers
builder.Services.AddScoped<Puod.Services.User.Services.Identity.LocalIdentityProvider>();
builder.Services.AddScoped<Puod.Services.User.Services.Identity.WindowsAdIdentityProvider>();
builder.Services.AddScoped<Puod.Services.User.Services.Identity.AzureAdIdentityProvider>();

builder.Services.AddDbContext<PuodDbContext>((sp, options) =>
{
    var store = sp.GetRequiredService<BootstrapDatabaseStore>();
    var bootstrapConfig = store.LoadAsync(CancellationToken.None).GetAwaiter().GetResult();
    var config = sp.GetRequiredService<IConfiguration>();

    var provider = bootstrapConfig?.Provider
                   ?? config.GetValue<string>("Provider")
                   ?? config.GetValue<string>("DatabaseProvider")
                   ?? "postgres";

    var envConnectionString = Environment.GetEnvironmentVariable("ConnectionString")
                              ?? Environment.GetEnvironmentVariable("CONNECTIONSTRING")
                              ?? Environment.GetEnvironmentVariable("ConnectionStrings__DefaultConnection");

    var connectionString = !string.IsNullOrWhiteSpace(envConnectionString)
                           ? envConnectionString
                           : bootstrapConfig?.ConnectionString
                             ?? config.GetValue<string>("ConnectionString")
                             ?? config.GetConnectionString("DefaultConnection");

    if (string.IsNullOrWhiteSpace(connectionString))
    {
        throw new InvalidOperationException("Database connection is not configured.");
    }

    var normalized = provider.Trim().ToLowerInvariant();
    if (normalized == "postgresql" || normalized == "postgres-docker")
    {
        normalized = "postgres";
    }

    if (normalized == "sqlserver" || normalized == "mssql")
    {
        options.UseSqlServer(
            connectionString,
            sql => sql.MigrationsAssembly(SqlServerMigrationsAssembly));
        return;
    }

    if (normalized == "mysql")
    {
        options.UseMySql(
            connectionString,
            ServerVersion.AutoDetect(connectionString),
            mysql => mysql.MigrationsAssembly(MySqlMigrationsAssembly));
        return;
    }

    options.UseNpgsql(
        connectionString,
        postgres => postgres.MigrationsAssembly(PostgresMigrationsAssembly));
});

builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("SystemAdmin", policy => policy.RequireRole(SystemRoles.PlatformAdmin));
});

builder.Services.AddApiVersioning(options =>
{
    options.DefaultApiVersion = new Asp.Versioning.ApiVersion(1, 0);
    options.AssumeDefaultVersionWhenUnspecified = true;
    options.ReportApiVersions = true;
    options.ApiVersionReader = new Asp.Versioning.UrlSegmentApiVersionReader();
})
.AddApiExplorer(options =>
{
    options.GroupNameFormat = "'v'VVV";
    options.SubstituteApiVersionInUrl = true;
});

builder.Services.AddControllers();

builder.Services.AddSingleton<IAuthorizationPolicyProvider, PermissionPolicyProvider>();
builder.Services.AddSingleton<IAuthorizationHandler, PermissionAuthorizationHandler>();

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyMethod()
              .AllowAnyHeader();
    });
});

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new() { Title = "PUOD User Service API", Version = "v1" });
    c.AddSecurityDefinition("Bearer", new()
    {
        Description = "JWT Authorization header using the Bearer scheme. Example: \"Bearer {token}\"",
        Name = "Authorization",
        In = Microsoft.OpenApi.Models.ParameterLocation.Header,
        Type = Microsoft.OpenApi.Models.SecuritySchemeType.ApiKey,
        Scheme = "Bearer"
    });
    c.AddSecurityRequirement(new()
    {
        {
            new()
            {
                Reference = new()
                {
                    Type = Microsoft.OpenApi.Models.ReferenceType.SecurityScheme,
                    Id = "Bearer"
                }
            },
            Array.Empty<string>()
        }
    });
});

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors("AllowAll");

app.Use(async (context, next) =>
{
    var store = context.RequestServices.GetRequiredService<BootstrapDatabaseStore>();
    var readiness = context.RequestServices.GetRequiredService<DatabaseReadinessChecker>();
    var config = await store.LoadAsync(context.RequestAborted);
    var appConfig = context.RequestServices.GetRequiredService<IConfiguration>();
    var provider = config?.Provider
                   ?? appConfig.GetValue<string>("Provider")
                   ?? appConfig.GetValue<string>("DatabaseProvider")
                   ?? "postgres";
    var envConnectionString = Environment.GetEnvironmentVariable("ConnectionString")
                              ?? Environment.GetEnvironmentVariable("CONNECTIONSTRING")
                              ?? Environment.GetEnvironmentVariable("ConnectionStrings__DefaultConnection");
    var effectiveConnectionString = !string.IsNullOrWhiteSpace(envConnectionString)
        ? envConnectionString
        : config?.ConnectionString;
    var hasConnection = !string.IsNullOrWhiteSpace(effectiveConnectionString);
    var isProvisioned = config?.ProvisionedAt != null && hasConnection;

    if (hasConnection)
    {
        var effectiveConfig = config ?? new BootstrapDatabaseConfig();
        effectiveConfig.Provider = provider;
        effectiveConfig.ConnectionString = effectiveConnectionString!;

        var tablesReady = await readiness.HasUsersTableAsync(effectiveConfig, context.RequestAborted);
        if (tablesReady)
        {
            var shouldPersist = config == null
                                || !string.Equals(config.ConnectionString, effectiveConnectionString, StringComparison.Ordinal)
                                || !string.Equals(config.Provider, provider, StringComparison.OrdinalIgnoreCase)
                                || config.ProvisionedAt == null;
            if (shouldPersist)
            {
                effectiveConfig.UpdatedAt = DateTime.UtcNow;
                effectiveConfig.ProvisionedAt = DateTime.UtcNow;
                await store.SaveAsync(effectiveConfig, context.RequestAborted);
            }
            isProvisioned = true;
        }
        else if (!tablesReady && isProvisioned && config != null)
        {
            config.ProvisionedAt = null;
            await store.SaveAsync(config, context.RequestAborted);
            isProvisioned = false;
        }
    }

    if (!isProvisioned)
    {
        var path = context.Request.Path;
        if (!BootstrapRouteAllowList.IsAllowed(path))
        {
            context.Response.StatusCode = StatusCodes.Status503ServiceUnavailable;
            await context.Response.WriteAsJsonAsync(new
            {
                message = "Database is not configured. Use the setup wizard to configure the database first."
            });
            return;
        }
    }

    await next();
});

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.MapGet("/health", () => new
{
    status = "healthy",
    service = "user",
    timestamp = DateTime.UtcNow
});

// Execute Seeder
using (var scope = app.Services.CreateScope())
{
    try
    {
        var dbContext = scope.ServiceProvider.GetRequiredService<PuodDbContext>();
        var schemaEnsurer = scope.ServiceProvider.GetRequiredService<RoleLinkSchemaEnsurer>();
        var providerName = dbContext.Database.ProviderName?.ToLowerInvariant() ?? "postgres";
        var provider = providerName.Contains("npgsql")
            ? "postgres"
            : providerName.Contains("sqlserver")
                ? "sqlserver"
                : providerName.Contains("mysql")
                    ? "mysql"
                    : "postgres";
        await schemaEnsurer.EnsureAsync(dbContext, provider, CancellationToken.None);

        var seeder = scope.ServiceProvider.GetRequiredService<BootstrapSeeder>();
        await seeder.SeedAsync();
    }
    catch (Exception ex)
    {
        var logger = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();
        logger.LogError(ex, "An error occurred while seeding the database.");
    }
}

app.Run();
