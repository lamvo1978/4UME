using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FourUme.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class PracticeSentences : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "PracticeSentences",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Level = table.Column<string>(type: "character varying(8)", maxLength: 8, nullable: false),
                    Topic = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: false),
                    En = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    Vi = table.Column<string>(type: "character varying(400)", maxLength: 400, nullable: false),
                    Voice = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    AudioUrl = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    AudioText = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true),
                    Published = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PracticeSentences", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_PracticeSentences_Level_Published",
                table: "PracticeSentences",
                columns: new[] { "Level", "Published" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "PracticeSentences");
        }
    }
}
