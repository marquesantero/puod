using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Puod.Services.Studio.Migrations
{
    /// <inheritdoc />
    public partial class AddDashboardCardTitleVisibility : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "description",
                table: "studio_dashboard_cards",
                type: "character varying(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "show_description",
                table: "studio_dashboard_cards",
                type: "boolean",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<bool>(
                name: "show_title",
                table: "studio_dashboard_cards",
                type: "boolean",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<string>(
                name: "title",
                table: "studio_dashboard_cards",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "description",
                table: "studio_dashboard_cards");

            migrationBuilder.DropColumn(
                name: "show_description",
                table: "studio_dashboard_cards");

            migrationBuilder.DropColumn(
                name: "show_title",
                table: "studio_dashboard_cards");

            migrationBuilder.DropColumn(
                name: "title",
                table: "studio_dashboard_cards");
        }
    }
}
