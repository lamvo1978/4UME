using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FourUme.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class ListeningLogs : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ListeningLogs",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    LocalDate = table.Column<DateOnly>(type: "date", nullable: false),
                    LessonSlug = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    Kind = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ListeningLogs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ListeningLogs_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ListeningLogs_UserId_LocalDate",
                table: "ListeningLogs",
                columns: new[] { "UserId", "LocalDate" });

            // History before this table: one listen per piece, on the (Vietnam) day it was first finished.
            migrationBuilder.Sql("""
                INSERT INTO "ListeningLogs" ("Id", "UserId", "LocalDate", "LessonSlug", "Kind", "CreatedAt")
                SELECT gen_random_uuid(), "UserId", ("CompletedAt" AT TIME ZONE 'Asia/Ho_Chi_Minh')::date, "LessonSlug", 0, "CompletedAt"
                FROM "ListeningProgresses"
                WHERE "CompletedAt" IS NOT NULL;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ListeningLogs");
        }
    }
}
