using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FourUme.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddReviewLevels : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "LapseCount",
                table: "WordProgresses",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "ReviewLevel",
                table: "WordProgresses",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            // Words already marked Known (Status = 2) enter the review schedule at level 1.
            migrationBuilder.Sql("""
                UPDATE "WordProgresses"
                SET "ReviewLevel" = 1,
                    "NextReviewAt" = COALESCE("NextReviewAt", NOW() + INTERVAL '1 day')
                WHERE "Status" = 2;
                UPDATE "WordProgresses"
                SET "NextReviewAt" = NULL
                WHERE "Status" <> 2;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "LapseCount",
                table: "WordProgresses");

            migrationBuilder.DropColumn(
                name: "ReviewLevel",
                table: "WordProgresses");
        }
    }
}
