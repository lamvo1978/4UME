using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FourUme.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddStudyActivityAndSettings : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "AutoSpeak",
                table: "Users",
                type: "boolean",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<int>(
                name: "BestStreak",
                table: "Users",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "DailyGoal",
                table: "Users",
                type: "integer",
                nullable: false,
                defaultValue: 10);

            migrationBuilder.AddColumn<bool>(
                name: "ReminderEnabled",
                table: "Users",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "ReminderTime",
                table: "Users",
                type: "character varying(5)",
                maxLength: 5,
                nullable: false,
                defaultValue: "20:00");

            migrationBuilder.AddColumn<double>(
                name: "SpeechRate",
                table: "Users",
                type: "double precision",
                nullable: false,
                defaultValue: 0.9);

            migrationBuilder.AddColumn<int>(
                name: "StreakFreezes",
                table: "Users",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateTable(
                name: "StudyDays",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    Date = table.Column<DateOnly>(type: "date", nullable: false),
                    NewWords = table.Column<int>(type: "integer", nullable: false),
                    Reviews = table.Column<int>(type: "integer", nullable: false),
                    GrammarItems = table.Column<int>(type: "integer", nullable: false),
                    Frozen = table.Column<bool>(type: "boolean", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_StudyDays", x => x.Id);
                    table.ForeignKey(
                        name: "FK_StudyDays_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_StudyDays_UserId_Date",
                table: "StudyDays",
                columns: new[] { "UserId", "Date" },
                unique: true);

            // Rebuild past study days (Vietnam time) from existing progress so streaks start with real history.
            migrationBuilder.Sql("""
                INSERT INTO "StudyDays" ("Id", "UserId", "Date", "NewWords", "Reviews", "GrammarItems", "Frozen", "UpdatedAt")
                SELECT gen_random_uuid(), a."UserId", a."Date", SUM(a."NewWords"), 0, SUM(a."GrammarItems"), FALSE, NOW()
                FROM (
                    SELECT "UserId", ("UpdatedAt" AT TIME ZONE 'Asia/Ho_Chi_Minh')::date AS "Date",
                           CASE WHEN "Status" = 2 THEN 1 ELSE 0 END AS "NewWords", 0 AS "GrammarItems"
                    FROM "WordProgresses"
                    UNION ALL
                    SELECT "UserId", ("CreatedAt" AT TIME ZONE 'Asia/Ho_Chi_Minh')::date, 0, 1
                    FROM "GrammarAttempts"
                ) a
                GROUP BY a."UserId", a."Date";
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "StudyDays");

            migrationBuilder.DropColumn(
                name: "AutoSpeak",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "BestStreak",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "DailyGoal",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "ReminderEnabled",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "ReminderTime",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "SpeechRate",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "StreakFreezes",
                table: "Users");
        }
    }
}
