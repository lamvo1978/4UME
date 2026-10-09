using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FourUme.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class Listening : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "Listens",
                table: "StudyDays",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateTable(
                name: "ListeningLessons",
                columns: table => new
                {
                    Slug = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    Version = table.Column<int>(type: "integer", nullable: false),
                    TitleEn = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    TitleVi = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    SummaryVi = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    Kind = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    Level = table.Column<string>(type: "character varying(8)", maxLength: 8, nullable: false),
                    Topic = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: true),
                    SortOrder = table.Column<int>(type: "integer", nullable: false),
                    Published = table.Column<bool>(type: "boolean", nullable: false),
                    SpeakersJson = table.Column<string>(type: "jsonb", nullable: false),
                    LinesJson = table.Column<string>(type: "jsonb", nullable: false),
                    AudioUrl = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true),
                    AudioHash = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    DurationMs = table.Column<int>(type: "integer", nullable: true),
                    TimingsJson = table.Column<string>(type: "jsonb", nullable: true),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    EditedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ListeningLessons", x => x.Slug);
                });

            migrationBuilder.CreateTable(
                name: "ListeningProgresses",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    LessonSlug = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    PositionMs = table.Column<int>(type: "integer", nullable: false),
                    CompletedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    TimesCompleted = table.Column<int>(type: "integer", nullable: false),
                    Liked = table.Column<bool>(type: "boolean", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ListeningProgresses", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ListeningProgresses_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ListeningLessons_SortOrder",
                table: "ListeningLessons",
                column: "SortOrder");

            migrationBuilder.CreateIndex(
                name: "IX_ListeningProgresses_LessonSlug",
                table: "ListeningProgresses",
                column: "LessonSlug");

            migrationBuilder.CreateIndex(
                name: "IX_ListeningProgresses_UserId_LessonSlug",
                table: "ListeningProgresses",
                columns: new[] { "UserId", "LessonSlug" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ListeningLessons");

            migrationBuilder.DropTable(
                name: "ListeningProgresses");

            migrationBuilder.DropColumn(
                name: "Listens",
                table: "StudyDays");
        }
    }
}
