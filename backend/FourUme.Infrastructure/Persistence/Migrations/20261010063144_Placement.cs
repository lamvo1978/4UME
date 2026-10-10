using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FourUme.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class Placement : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "FromPlacement",
                table: "WordProgresses",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "EasyWordMode",
                table: "Users",
                type: "character varying(8)",
                maxLength: 8,
                nullable: false,
                defaultValue: "skip");

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "PlacementTakenAt",
                table: "Users",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "VocabLevel",
                table: "Users",
                type: "character varying(2)",
                maxLength: 2,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "FromPlacement",
                table: "WordProgresses");

            migrationBuilder.DropColumn(
                name: "EasyWordMode",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "PlacementTakenAt",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "VocabLevel",
                table: "Users");
        }
    }
}
