using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Puod.Services.Studio.Migrations
{
    /// <inheritdoc />
    public partial class AddStudioAuditColumns : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "updated_at",
                table: "studio_shares",
                type: "timestamp with time zone",
                nullable: false,
                defaultValueSql: "now()");

            migrationBuilder.AddColumn<DateTime>(
                name: "deleted_at",
                table: "studio_dashboards",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "deleted_at",
                table: "studio_cards",
                type: "timestamp with time zone",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "updated_at",
                table: "studio_shares");

            migrationBuilder.DropColumn(
                name: "deleted_at",
                table: "studio_dashboards");

            migrationBuilder.DropColumn(
                name: "deleted_at",
                table: "studio_cards");
        }
    }
}
