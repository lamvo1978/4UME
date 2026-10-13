using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FourUme.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class GrammarPractice : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "PracticeJson",
                table: "GrammarLessons",
                type: "jsonb",
                nullable: false,
                defaultValueSql: "'[]'::jsonb");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "PracticeJson",
                table: "GrammarLessons");
        }
    }
}
