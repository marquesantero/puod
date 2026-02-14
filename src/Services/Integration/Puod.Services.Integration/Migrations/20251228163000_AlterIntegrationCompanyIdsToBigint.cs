using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Puod.Services.Integration.Migrations
{
    /// <inheritdoc />
    public partial class AlterIntegrationCompanyIdsToBigint : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
@"ALTER TABLE integrations
    ALTER COLUMN company_ids DROP NOT NULL;
ALTER TABLE integrations
    ALTER COLUMN company_ids TYPE bigint[]
    USING CASE
        WHEN company_ids IS NULL THEN NULL
        ELSE '{}'::bigint[]
    END;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
@"ALTER TABLE integrations
    ALTER COLUMN company_ids TYPE uuid[]
    USING NULL;");
        }
    }
}
