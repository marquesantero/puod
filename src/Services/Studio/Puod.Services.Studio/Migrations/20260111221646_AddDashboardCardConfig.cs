using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Puod.Services.Studio.Migrations
{
    /// <inheritdoc />
    public partial class AddDashboardCardConfig : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "data_source_json",
                table: "studio_dashboard_cards",
                type: "jsonb",
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "integration_id",
                table: "studio_dashboard_cards",
                type: "bigint",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "data_source_json",
                table: "studio_dashboard_cards");

            migrationBuilder.DropColumn(
                name: "integration_id",
                table: "studio_dashboard_cards");
        }
    }
}
