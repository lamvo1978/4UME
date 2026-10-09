using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FourUme.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddGrammarLessons : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "GrammarLessons",
                columns: table => new
                {
                    Slug = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    Version = table.Column<int>(type: "integer", nullable: false),
                    TitleVi = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    TitleEn = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    Level = table.Column<string>(type: "character varying(8)", maxLength: 8, nullable: false),
                    SortOrder = table.Column<int>(type: "integer", nullable: false),
                    SummaryVi = table.Column<string>(type: "text", nullable: false),
                    QuizSize = table.Column<int>(type: "integer", nullable: false),
                    Published = table.Column<bool>(type: "boolean", nullable: false),
                    SectionsJson = table.Column<string>(type: "jsonb", nullable: false),
                    ExercisesJson = table.Column<string>(type: "jsonb", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_GrammarLessons", x => x.Slug);
                });

            migrationBuilder.CreateTable(
                name: "GrammarProgresses",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    LessonSlug = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    ReviewLevel = table.Column<int>(type: "integer", nullable: false),
                    LapseCount = table.Column<int>(type: "integer", nullable: false),
                    NextReviewAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_GrammarProgresses", x => x.Id);
                    table.ForeignKey(
                        name: "FK_GrammarProgresses_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_GrammarLessons_SortOrder",
                table: "GrammarLessons",
                column: "SortOrder");

            migrationBuilder.CreateIndex(
                name: "IX_GrammarProgresses_UserId_LessonSlug",
                table: "GrammarProgresses",
                columns: new[] { "UserId", "LessonSlug" },
                unique: true);

            // Lessons already passed (≥ 70% on some attempt) start in review at level 1.
            migrationBuilder.Sql("""
                INSERT INTO "GrammarProgresses" ("Id", "UserId", "LessonSlug", "ReviewLevel", "LapseCount", "NextReviewAt", "UpdatedAt")
                SELECT gen_random_uuid(), a."UserId", a."LessonSlug", 1, 0, NOW() + INTERVAL '1 day', NOW()
                FROM "GrammarAttempts" a
                WHERE a."Total" > 0
                GROUP BY a."UserId", a."LessonSlug"
                HAVING MAX(a."Score"::float / a."Total") >= 0.7;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "GrammarLessons");

            migrationBuilder.DropTable(
                name: "GrammarProgresses");
        }
    }
}
