using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FourUme.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class PlacementGrammarReviewHints : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ReviewHintVi",
                table: "PlacementGrammarQuestions",
                type: "character varying(400)",
                maxLength: 400,
                nullable: true);

            migrationBuilder.Sql(
                """
                ALTER TABLE "PlacementGrammarQuestions"
                ADD COLUMN "ReviewSuggestedAcceptedAnswers" text[] NOT NULL DEFAULT '{}';
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ReviewHintVi",
                table: "PlacementGrammarQuestions");

            migrationBuilder.DropColumn(
                name: "ReviewSuggestedAcceptedAnswers",
                table: "PlacementGrammarQuestions");
        }
    }
}
