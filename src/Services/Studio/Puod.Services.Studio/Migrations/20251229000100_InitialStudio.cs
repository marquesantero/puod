using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Puod.Services.Studio.Migrations
{
    public partial class InitialStudio : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "studio_cards",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    owner_user_id = table.Column<long>(type: "bigint", nullable: false),
                    scope = table.Column<int>(type: "integer", nullable: false),
                    client_id = table.Column<long>(type: "bigint", nullable: true),
                    profile_id = table.Column<long>(type: "bigint", nullable: true),
                    title = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    description = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    card_type = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    layout_type = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    status = table.Column<int>(type: "integer", nullable: false),
                    integration_id = table.Column<long>(type: "bigint", nullable: true),
                    query = table.Column<string>(type: "text", nullable: true),
                    fields_json = table.Column<string>(type: "jsonb", nullable: true),
                    style_json = table.Column<string>(type: "jsonb", nullable: true),
                    layout_json = table.Column<string>(type: "jsonb", nullable: true),
                    refresh_policy_json = table.Column<string>(type: "jsonb", nullable: true),
                    data_source_json = table.Column<string>(type: "jsonb", nullable: true),
                    last_tested_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    last_test_succeeded = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    last_test_signature = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    is_deleted = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_studio_cards", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "studio_card_cache",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    card_id = table.Column<long>(type: "bigint", nullable: false),
                    refreshed_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    expires_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    success = table.Column<bool>(type: "boolean", nullable: false),
                    data_json = table.Column<string>(type: "jsonb", nullable: true),
                    error_message = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_studio_card_cache", x => x.id);
                    table.ForeignKey(
                        name: "FK_studio_card_cache_studio_cards_card_id",
                        column: x => x.card_id,
                        principalTable: "studio_cards",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "studio_dashboards",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    owner_user_id = table.Column<long>(type: "bigint", nullable: false),
                    scope = table.Column<int>(type: "integer", nullable: false),
                    client_id = table.Column<long>(type: "bigint", nullable: true),
                    profile_id = table.Column<long>(type: "bigint", nullable: true),
                    name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    description = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    layout_type = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    status = table.Column<int>(type: "integer", nullable: false),
                    layout_json = table.Column<string>(type: "jsonb", nullable: true),
                    refresh_policy_json = table.Column<string>(type: "jsonb", nullable: true),
                    is_deleted = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_studio_dashboards", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "studio_shares",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    target_type = table.Column<int>(type: "integer", nullable: false),
                    target_id = table.Column<long>(type: "bigint", nullable: false),
                    subject_type = table.Column<int>(type: "integer", nullable: false),
                    subject_id = table.Column<long>(type: "bigint", nullable: false),
                    access_level = table.Column<int>(type: "integer", nullable: false),
                    shared_by_user_id = table.Column<long>(type: "bigint", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_studio_shares", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "studio_dashboard_cards",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    dashboard_id = table.Column<long>(type: "bigint", nullable: false),
                    card_id = table.Column<long>(type: "bigint", nullable: false),
                    order_index = table.Column<int>(type: "integer", nullable: false),
                    position_x = table.Column<int>(type: "integer", nullable: false),
                    position_y = table.Column<int>(type: "integer", nullable: false),
                    width = table.Column<int>(type: "integer", nullable: false),
                    height = table.Column<int>(type: "integer", nullable: false),
                    layout_json = table.Column<string>(type: "jsonb", nullable: true),
                    refresh_policy_json = table.Column<string>(type: "jsonb", nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_studio_dashboard_cards", x => x.id);
                    table.ForeignKey(
                        name: "FK_studio_dashboard_cards_studio_cards_card_id",
                        column: x => x.card_id,
                        principalTable: "studio_cards",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_studio_dashboard_cards_studio_dashboards_dashboard_id",
                        column: x => x.dashboard_id,
                        principalTable: "studio_dashboards",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_studio_card_cache_card_id",
                table: "studio_card_cache",
                column: "card_id");

            migrationBuilder.CreateIndex(
                name: "IX_studio_cards_client_id",
                table: "studio_cards",
                column: "client_id");

            migrationBuilder.CreateIndex(
                name: "IX_studio_cards_integration_id",
                table: "studio_cards",
                column: "integration_id");

            migrationBuilder.CreateIndex(
                name: "IX_studio_cards_owner_user_id",
                table: "studio_cards",
                column: "owner_user_id");

            migrationBuilder.CreateIndex(
                name: "IX_studio_cards_profile_id",
                table: "studio_cards",
                column: "profile_id");

            migrationBuilder.CreateIndex(
                name: "IX_studio_dashboard_cards_card_id",
                table: "studio_dashboard_cards",
                column: "card_id");

            migrationBuilder.CreateIndex(
                name: "IX_studio_dashboard_cards_dashboard_id",
                table: "studio_dashboard_cards",
                column: "dashboard_id");

            migrationBuilder.CreateIndex(
                name: "IX_studio_dashboards_client_id",
                table: "studio_dashboards",
                column: "client_id");

            migrationBuilder.CreateIndex(
                name: "IX_studio_dashboards_owner_user_id",
                table: "studio_dashboards",
                column: "owner_user_id");

            migrationBuilder.CreateIndex(
                name: "IX_studio_dashboards_profile_id",
                table: "studio_dashboards",
                column: "profile_id");

            migrationBuilder.CreateIndex(
                name: "IX_studio_shares_target_type_target_id",
                table: "studio_shares",
                columns: new[] { "target_type", "target_id" });

            migrationBuilder.CreateIndex(
                name: "IX_studio_shares_subject_type_subject_id",
                table: "studio_shares",
                columns: new[] { "subject_type", "subject_id" });
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "studio_card_cache");

            migrationBuilder.DropTable(
                name: "studio_dashboard_cards");

            migrationBuilder.DropTable(
                name: "studio_shares");

            migrationBuilder.DropTable(
                name: "studio_cards");

            migrationBuilder.DropTable(
                name: "studio_dashboards");
        }
    }
}
