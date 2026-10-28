using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FourUme.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class PlacementGrammarAcceptedAnswers : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Backfill existing rows with an empty array; NOT NULL without DEFAULT fails on Postgres.
            migrationBuilder.Sql(
                """
                ALTER TABLE "PlacementGrammarQuestions"
                ADD COLUMN "AcceptedAnswers" text[] NOT NULL DEFAULT '{}';
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AcceptedAnswers",
                table: "PlacementGrammarQuestions");
        }
    }
}
