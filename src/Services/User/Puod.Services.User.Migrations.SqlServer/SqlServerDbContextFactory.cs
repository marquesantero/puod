using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using Puod.Services.User.Data;

namespace Puod.Services.User.Migrations;

public class SqlServerDbContextFactory : IDesignTimeDbContextFactory<PuodDbContext>
{
    public PuodDbContext CreateDbContext(string[] args)
    {
        var optionsBuilder = new DbContextOptionsBuilder<PuodDbContext>();
        optionsBuilder.UseSqlServer(
            "Server=localhost,1433;Database=puod;User Id=sa;Password=YourStrong!Passw0rd;TrustServerCertificate=True",
            options => options.MigrationsAssembly(typeof(SqlServerDbContextFactory).Assembly.GetName().Name));
        return new PuodDbContext(optionsBuilder.Options);
    }
}
