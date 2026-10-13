using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FourUme.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class PlacementGrammar : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "PlacementGrammarQuestions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Level = table.Column<string>(type: "character varying(8)", maxLength: 8, nullable: false),
                    Prompt = table.Column<string>(type: "character varying(400)", maxLength: 400, nullable: false),
                    Options = table.Column<List<string>>(type: "text[]", nullable: false),
                    Answer = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    ExplanationVi = table.Column<string>(type: "character varying(600)", maxLength: 600, nullable: false),
                    LessonSlug = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: true),
                    Published = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PlacementGrammarQuestions", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_PlacementGrammarQuestions_Level_Published",
                table: "PlacementGrammarQuestions",
                columns: new[] { "Level", "Published" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "PlacementGrammarQuestions");
        }
    }
}
