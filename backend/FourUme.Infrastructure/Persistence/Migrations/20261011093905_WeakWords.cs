using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FourUme.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class WeakWords : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "WeakScore",
                table: "WordProgresses",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            // Words already forgotten in review start out listed, as after one mistake.
            migrationBuilder.Sql("""UPDATE "WordProgresses" SET "WeakScore" = 2 WHERE "LapseCount" > 0;""");

            migrationBuilder.AddColumn<string>(
                name: "Phonemes",
                table: "PronunciationAttempts",
                type: "text",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_PronunciationAttempts_UserId_WordId_CreatedAt",
                table: "PronunciationAttempts",
                columns: new[] { "UserId", "WordId", "CreatedAt" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_PronunciationAttempts_UserId_WordId_CreatedAt",
                table: "PronunciationAttempts");

            migrationBuilder.DropColumn(
                name: "WeakScore",
                table: "WordProgresses");

            migrationBuilder.DropColumn(
                name: "Phonemes",
                table: "PronunciationAttempts");
        }
    }
}
