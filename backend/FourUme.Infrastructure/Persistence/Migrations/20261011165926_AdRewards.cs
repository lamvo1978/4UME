using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FourUme.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AdRewards : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "AdRewards",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    LocalDate = table.Column<DateOnly>(type: "date", nullable: false),
                    TransactionId = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    Source = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AdRewards", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AdRewards_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_AdRewards_CreatedAt",
                table: "AdRewards",
                column: "CreatedAt");

            migrationBuilder.CreateIndex(
                name: "IX_AdRewards_TransactionId",
                table: "AdRewards",
                column: "TransactionId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_AdRewards_UserId_LocalDate",
                table: "AdRewards",
                columns: new[] { "UserId", "LocalDate" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "AdRewards");
        }
    }
}
