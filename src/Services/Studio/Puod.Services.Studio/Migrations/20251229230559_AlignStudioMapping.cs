using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Puod.Services.Studio.Migrations
{
    /// <inheritdoc />
    public partial class AlignStudioMapping : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<bool>(
                name: "last_test_succeeded",
                table: "studio_cards",
                type: "boolean",
                nullable: false,
                oldClrType: typeof(bool),
                oldType: "boolean",
                oldDefaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<bool>(
                name: "last_test_succeeded",
                table: "studio_cards",
                type: "boolean",
                nullable: false,
                defaultValue: false,
                oldClrType: typeof(bool),
                oldType: "boolean");
        }
    }
}
