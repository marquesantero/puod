using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using Puod.Services.User.Data;

namespace Puod.Services.User.Migrations;

public class PostgresDbContextFactory : IDesignTimeDbContextFactory<PuodDbContext>
{
    public PuodDbContext CreateDbContext(string[] args)
    {
        var optionsBuilder = new DbContextOptionsBuilder<PuodDbContext>();
        optionsBuilder.UseNpgsql(
            "Host=localhost;Port=5432;Database=puod;Username=puod_user;Password=puod_dev_password_2024",
            options => options.MigrationsAssembly(typeof(PostgresDbContextFactory).Assembly.GetName().Name));
        return new PuodDbContext(optionsBuilder.Options);
    }
}
