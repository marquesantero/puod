using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using Microsoft.Extensions.Configuration;

namespace Puod.Services.User.Data;

public class PuodDbContextFactory : IDesignTimeDbContextFactory<PuodDbContext>
{
    public PuodDbContext CreateDbContext(string[] args)
    {
        var environment = Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") ?? "Development";
        
        // Try to find the startup project path
        var currentDir = Directory.GetCurrentDirectory();
        var basePath = currentDir;

        if (!File.Exists(Path.Combine(basePath, "appsettings.json")))
        {
             // Fallback if running from root or elsewhere
             if (Directory.Exists(Path.Combine(basePath, "src/Services/User/Puod.Services.User")))
             {
                 basePath = Path.Combine(basePath, "src/Services/User/Puod.Services.User");
             }
        }

        var config = new ConfigurationBuilder()
            .SetBasePath(basePath)
            .AddJsonFile("appsettings.json", optional: true)
            .AddJsonFile($"appsettings.{environment}.json", optional: true)
            .AddEnvironmentVariables()
            .Build();

        var builder = new DbContextOptionsBuilder<PuodDbContext>();
        
        // Allow overriding via specific env var for migration generation
        var provider = Environment.GetEnvironmentVariable("EF_PROVIDER") 
                       ?? config["Provider"] 
                       ?? "postgres";

        var connectionString = config.GetConnectionString("DefaultConnection") 
                               ?? "Host=localhost;Database=puod;Username=user;Password=pass";

        provider = provider.Trim().ToLowerInvariant();

        if (provider == "sqlserver" || provider == "mssql")
        {
            builder.UseSqlServer(connectionString, b => b.MigrationsAssembly("Puod.Services.User.Migrations.SqlServer"));
        }
        else if (provider == "mysql")
        {
            // Dummy connection string for design time if the real one isn't valid for parsing version
            if (connectionString == "Host=localhost;Database=puod;Username=user;Password=pass")
            {
                 // MySql connector might fail if it can't connect to detect version
                 // defaulting to a recent version safe for generation
                 builder.UseMySql(connectionString, new MariaDbServerVersion(new Version(10, 6, 0)), b => b.MigrationsAssembly("Puod.Services.User.Migrations.MySql"));
            }
            else 
            {
                try 
                {
                    builder.UseMySql(connectionString, ServerVersion.AutoDetect(connectionString), b => b.MigrationsAssembly("Puod.Services.User.Migrations.MySql"));
                }
                catch
                {
                     // Fallback for design time
                     builder.UseMySql(connectionString, new MariaDbServerVersion(new Version(10, 6, 0)), b => b.MigrationsAssembly("Puod.Services.User.Migrations.MySql"));
                }
            }
        }
        else
        {
            builder.UseNpgsql(connectionString, b => b.MigrationsAssembly("Puod.Services.User.Migrations.Postgres"));
        }

        return new PuodDbContext(builder.Options);
    }
}
