using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Puod.Services.Studio.Migrations
{
    /// <inheritdoc />
    public partial class AddDashboardCardConfigOrdered : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Create temp table with columns in correct order (new columns before created_at/updated_at)
            migrationBuilder.Sql(@"
                CREATE TABLE studio_dashboard_cards_temp (
                    id bigserial PRIMARY KEY,
                    dashboard_id bigint NOT NULL,
                    card_id bigint NOT NULL,
                    order_index integer NOT NULL,
                    position_x integer NOT NULL,
                    position_y integer NOT NULL,
                    width integer NOT NULL,
                    height integer NOT NULL,
                    layout_json jsonb,
                    refresh_policy_json jsonb,
                    integration_id bigint,
                    data_source_json jsonb,
                    created_at timestamp with time zone NOT NULL DEFAULT now(),
                    updated_at timestamp with time zone NOT NULL DEFAULT now()
                );
            ");

            // Copy data from old table to temp table
            migrationBuilder.Sql(@"
                INSERT INTO studio_dashboard_cards_temp
                    (id, dashboard_id, card_id, order_index, position_x, position_y, width, height,
                     layout_json, refresh_policy_json, integration_id, data_source_json, created_at, updated_at)
                SELECT
                    id, dashboard_id, card_id, order_index, position_x, position_y, width, height,
                    layout_json, refresh_policy_json, NULL, NULL, created_at, updated_at
                FROM studio_dashboard_cards;
            ");

            // Update sequence to continue from current max id
            migrationBuilder.Sql(@"
                SELECT setval('studio_dashboard_cards_temp_id_seq',
                    (SELECT COALESCE(MAX(id), 1) FROM studio_dashboard_cards_temp));
            ");

            // Drop old table
            migrationBuilder.DropTable(name: "studio_dashboard_cards");

            // Rename temp table to original name
            migrationBuilder.RenameTable(
                name: "studio_dashboard_cards_temp",
                newName: "studio_dashboard_cards");

            // Recreate indexes and constraints
            migrationBuilder.CreateIndex(
                name: "ix_studio_dashboard_cards_dashboard_id",
                table: "studio_dashboard_cards",
                column: "dashboard_id");

            migrationBuilder.CreateIndex(
                name: "ix_studio_dashboard_cards_card_id",
                table: "studio_dashboard_cards",
                column: "card_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Recreate original table structure (without new columns)
            migrationBuilder.Sql(@"
                CREATE TABLE studio_dashboard_cards_temp (
                    id bigserial PRIMARY KEY,
                    dashboard_id bigint NOT NULL,
                    card_id bigint NOT NULL,
                    order_index integer NOT NULL,
                    position_x integer NOT NULL,
                    position_y integer NOT NULL,
                    width integer NOT NULL,
                    height integer NOT NULL,
                    layout_json jsonb,
                    refresh_policy_json jsonb,
                    created_at timestamp with time zone NOT NULL DEFAULT now(),
                    updated_at timestamp with time zone NOT NULL DEFAULT now()
                );
            ");

            // Copy data back (excluding new columns)
            migrationBuilder.Sql(@"
                INSERT INTO studio_dashboard_cards_temp
                    (id, dashboard_id, card_id, order_index, position_x, position_y, width, height,
                     layout_json, refresh_policy_json, created_at, updated_at)
                SELECT
                    id, dashboard_id, card_id, order_index, position_x, position_y, width, height,
                    layout_json, refresh_policy_json, created_at, updated_at
                FROM studio_dashboard_cards;
            ");

            // Update sequence
            migrationBuilder.Sql(@"
                SELECT setval('studio_dashboard_cards_temp_id_seq',
                    (SELECT COALESCE(MAX(id), 1) FROM studio_dashboard_cards_temp));
            ");

            // Drop current table
            migrationBuilder.DropTable(name: "studio_dashboard_cards");

            // Rename temp to original
            migrationBuilder.RenameTable(
                name: "studio_dashboard_cards_temp",
                newName: "studio_dashboard_cards");

            // Recreate indexes
            migrationBuilder.CreateIndex(
                name: "ix_studio_dashboard_cards_dashboard_id",
                table: "studio_dashboard_cards",
                column: "dashboard_id");

            migrationBuilder.CreateIndex(
                name: "ix_studio_dashboard_cards_card_id",
                table: "studio_dashboard_cards",
                column: "card_id");
        }
    }
}
