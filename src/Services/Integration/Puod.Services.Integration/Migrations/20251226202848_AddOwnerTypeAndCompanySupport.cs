using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Puod.Services.Integration.Migrations
{
    /// <inheritdoc />
    public partial class AddOwnerTypeAndCompanySupport : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "ClientId",
                table: "integrations",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<List<Guid>>(
                name: "CompanyIds",
                table: "integrations",
                type: "jsonb",
                nullable: false);

            migrationBuilder.AddColumn<int>(
                name: "OwnerType",
                table: "integrations",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateIndex(
                name: "IX_integrations_ClientId",
                table: "integrations",
                column: "ClientId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_integrations_ClientId",
                table: "integrations");

            migrationBuilder.DropColumn(
                name: "ClientId",
                table: "integrations");

            migrationBuilder.DropColumn(
                name: "CompanyIds",
                table: "integrations");

            migrationBuilder.DropColumn(
                name: "OwnerType",
                table: "integrations");
        }
    }
}
