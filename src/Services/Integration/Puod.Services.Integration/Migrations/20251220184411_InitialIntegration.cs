using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Puod.Services.Integration.Migrations
{
    /// <inheritdoc />
    public partial class InitialIntegration : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "integrations",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ProfileId = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    Type = table.Column<int>(type: "integer", nullable: false),
                    Configuration = table.Column<Dictionary<string, string>>(type: "jsonb", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastSyncAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_integrations", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "scheduled_monitors",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    integration_id = table.Column<Guid>(type: "uuid", nullable: false),
                    resource_type = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    resource_id = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    poll_interval_seconds = table.Column<int>(type: "integer", nullable: false),
                    last_poll_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    next_poll_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    last_status = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    last_error = table.Column<string>(type: "text", nullable: true),
                    consecutive_failures = table.Column<int>(type: "integer", nullable: false),
                    is_active = table.Column<bool>(type: "boolean", nullable: false),
                    configuration = table.Column<Dictionary<string, string>>(type: "jsonb", nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_scheduled_monitors", x => x.id);
                    table.ForeignKey(
                        name: "FK_scheduled_monitors_integrations_integration_id",
                        column: x => x.integration_id,
                        principalTable: "integrations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_integrations_ProfileId",
                table: "integrations",
                column: "ProfileId");

            migrationBuilder.CreateIndex(
                name: "IX_integrations_ProfileId_IsActive",
                table: "integrations",
                columns: new[] { "ProfileId", "IsActive" });

            migrationBuilder.CreateIndex(
                name: "IX_scheduled_monitors_integration_id",
                table: "scheduled_monitors",
                column: "integration_id");

            migrationBuilder.CreateIndex(
                name: "IX_scheduled_monitors_integration_id_is_active",
                table: "scheduled_monitors",
                columns: new[] { "integration_id", "is_active" });

            migrationBuilder.CreateIndex(
                name: "IX_scheduled_monitors_next_poll_at_is_active",
                table: "scheduled_monitors",
                columns: new[] { "next_poll_at", "is_active" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "scheduled_monitors");

            migrationBuilder.DropTable(
                name: "integrations");
        }
    }
}
