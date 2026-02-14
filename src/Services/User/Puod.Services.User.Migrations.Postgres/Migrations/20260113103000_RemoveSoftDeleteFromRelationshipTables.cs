using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Puod.Services.User.Migrations.Postgres.Migrations
{
    public partial class RemoveSoftDeleteFromRelationshipTables : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("DELETE FROM user_groups WHERE is_deleted = TRUE;");
            migrationBuilder.Sql("DELETE FROM user_tenant_roles WHERE is_deleted = TRUE;");
            migrationBuilder.Sql("DELETE FROM group_tenant_roles WHERE is_deleted = TRUE;");
            migrationBuilder.Sql("DELETE FROM client_user_company_availability WHERE is_deleted = TRUE;");

            migrationBuilder.DropColumn(
                name: "deleted_at",
                table: "user_groups");

            migrationBuilder.DropColumn(
                name: "deleted_by",
                table: "user_groups");

            migrationBuilder.DropColumn(
                name: "is_deleted",
                table: "user_groups");

            migrationBuilder.DropColumn(
                name: "deleted_at",
                table: "user_tenant_roles");

            migrationBuilder.DropColumn(
                name: "deleted_by",
                table: "user_tenant_roles");

            migrationBuilder.DropColumn(
                name: "is_deleted",
                table: "user_tenant_roles");

            migrationBuilder.DropColumn(
                name: "deleted_at",
                table: "group_tenant_roles");

            migrationBuilder.DropColumn(
                name: "deleted_by",
                table: "group_tenant_roles");

            migrationBuilder.DropColumn(
                name: "is_deleted",
                table: "group_tenant_roles");

            migrationBuilder.DropColumn(
                name: "deleted_at",
                table: "client_user_company_availability");

            migrationBuilder.DropColumn(
                name: "deleted_by",
                table: "client_user_company_availability");

            migrationBuilder.DropColumn(
                name: "is_deleted",
                table: "client_user_company_availability");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "deleted_at",
                table: "user_groups",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "deleted_by",
                table: "user_groups",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "is_deleted",
                table: "user_groups",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTime>(
                name: "deleted_at",
                table: "user_tenant_roles",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "deleted_by",
                table: "user_tenant_roles",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "is_deleted",
                table: "user_tenant_roles",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTime>(
                name: "deleted_at",
                table: "group_tenant_roles",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "deleted_by",
                table: "group_tenant_roles",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "is_deleted",
                table: "group_tenant_roles",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTime>(
                name: "deleted_at",
                table: "client_user_company_availability",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "deleted_by",
                table: "client_user_company_availability",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "is_deleted",
                table: "client_user_company_availability",
                type: "boolean",
                nullable: false,
                defaultValue: false);
        }
    }
}
