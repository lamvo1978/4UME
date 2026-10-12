using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FourUme.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class PartnerCodeExpiry : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Prefix",
                table: "Partners",
                type: "character varying(2)",
                maxLength: 2,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "ExpiresAt",
                table: "PartnerCodes",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<TimeSpan>(
                name: "HeldPremium",
                table: "PartnerCodes",
                type: "interval",
                nullable: true);

            // Partners created before prefixes existed get AA, AB, … in creation order; admins can change them while no code exists.
            migrationBuilder.Sql("""
                UPDATE "Partners" p
                SET "Prefix" = chr(65 + (n.rn - 1) / 26 % 26) || chr(65 + (n.rn - 1) % 26)
                FROM (SELECT "Id", (row_number() OVER (ORDER BY "CreatedAt", "Id"))::int AS rn FROM "Partners") n
                WHERE p."Id" = n."Id";
                """);

            migrationBuilder.CreateIndex(
                name: "IX_Partners_Prefix",
                table: "Partners",
                column: "Prefix",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Partners_Prefix",
                table: "Partners");

            migrationBuilder.DropColumn(
                name: "Prefix",
                table: "Partners");

            migrationBuilder.DropColumn(
                name: "ExpiresAt",
                table: "PartnerCodes");

            migrationBuilder.DropColumn(
                name: "HeldPremium",
                table: "PartnerCodes");
        }
    }
}
