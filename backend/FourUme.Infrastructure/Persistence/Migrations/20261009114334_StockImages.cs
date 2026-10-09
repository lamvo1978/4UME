using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FourUme.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class StockImages : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "ImagePending",
                table: "Words",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "Author",
                table: "MediaFiles",
                type: "character varying(120)",
                maxLength: 120,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "AuthorUrl",
                table: "MediaFiles",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Source",
                table: "MediaFiles",
                type: "character varying(16)",
                maxLength: 16,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SourceId",
                table: "MediaFiles",
                type: "character varying(40)",
                maxLength: 40,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SourceUrl",
                table: "MediaFiles",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Words_ImagePending",
                table: "Words",
                column: "ImagePending",
                filter: "\"ImagePending\"");

            migrationBuilder.CreateIndex(
                name: "IX_MediaFiles_Source_SourceId",
                table: "MediaFiles",
                columns: new[] { "Source", "SourceId" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Words_ImagePending",
                table: "Words");

            migrationBuilder.DropIndex(
                name: "IX_MediaFiles_Source_SourceId",
                table: "MediaFiles");

            migrationBuilder.DropColumn(
                name: "ImagePending",
                table: "Words");

            migrationBuilder.DropColumn(
                name: "Author",
                table: "MediaFiles");

            migrationBuilder.DropColumn(
                name: "AuthorUrl",
                table: "MediaFiles");

            migrationBuilder.DropColumn(
                name: "Source",
                table: "MediaFiles");

            migrationBuilder.DropColumn(
                name: "SourceId",
                table: "MediaFiles");

            migrationBuilder.DropColumn(
                name: "SourceUrl",
                table: "MediaFiles");
        }
    }
}
