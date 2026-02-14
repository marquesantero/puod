using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using Puod.Services.User.Data;

namespace Puod.Services.User.Migrations;

public class MySqlDbContextFactory : IDesignTimeDbContextFactory<PuodDbContext>
{
    public PuodDbContext CreateDbContext(string[] args)
    {
        var optionsBuilder = new DbContextOptionsBuilder<PuodDbContext>();
        var connectionString = "Server=localhost;Port=3306;Database=puod;User=puod_user;Password=puod_dev_password_2024";
        optionsBuilder.UseMySql(
            connectionString,
            ServerVersion.Parse("8.0.36"),
            options => options.MigrationsAssembly(typeof(MySqlDbContextFactory).Assembly.GetName().Name));
        return new PuodDbContext(optionsBuilder.Options);
    }
}
