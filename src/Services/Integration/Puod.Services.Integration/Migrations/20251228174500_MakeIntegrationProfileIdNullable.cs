using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Puod.Services.Integration.Migrations
{
    [DbContext(typeof(Data.IntegrationDbContext))]
    [Migration("20251228174500_MakeIntegrationProfileIdNullable")]
    public partial class MakeIntegrationProfileIdNullable : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
@"ALTER TABLE integrations
    ALTER COLUMN profile_id DROP NOT NULL;");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
@"ALTER TABLE integrations
    ALTER COLUMN profile_id SET NOT NULL;");
        }
    }
}
