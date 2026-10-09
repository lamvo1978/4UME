using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FourUme.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddDecksMediaPublished : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "EditedAt",
                table: "Words",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "Published",
                table: "Words",
                type: "boolean",
                nullable: false,
                defaultValue: true);

            migrationBuilder.CreateTable(
                name: "Decks",
                columns: table => new
                {
                    Id = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    TitleVi = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    Icon = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    SortOrder = table.Column<int>(type: "integer", nullable: false),
                    Published = table.Column<bool>(type: "boolean", nullable: false, defaultValue: true),
                    EditedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Decks", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "MediaFiles",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    FileName = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    Url = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    OriginalName = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    Width = table.Column<int>(type: "integer", nullable: false),
                    Height = table.Column<int>(type: "integer", nullable: false),
                    Bytes = table.Column<long>(type: "bigint", nullable: false),
                    UploadedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MediaFiles", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Decks_SortOrder",
                table: "Decks",
                column: "SortOrder");

            migrationBuilder.CreateIndex(
                name: "IX_MediaFiles_Url",
                table: "MediaFiles",
                column: "Url",
                unique: true);

            // Existing words already point at decks; create those rows before the foreign key exists.
            // Icon and order are refreshed from vocabulary.json by the seeder on startup.
            migrationBuilder.Sql("""
                INSERT INTO "Decks" ("Id", "TitleVi", "Icon", "SortOrder", "Published")
                SELECT "DeckId", MIN("DeckTitleVi"), 'albums-outline', 0, TRUE
                FROM "Words"
                GROUP BY "DeckId";
                """);

            migrationBuilder.DropColumn(
                name: "DeckTitleVi",
                table: "Words");

            migrationBuilder.AddForeignKey(
                name: "FK_Words_Decks_DeckId",
                table: "Words",
                column: "DeckId",
                principalTable: "Decks",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Words_Decks_DeckId",
                table: "Words");

            migrationBuilder.DropTable(
                name: "Decks");

            migrationBuilder.DropTable(
                name: "MediaFiles");

            migrationBuilder.DropColumn(
                name: "EditedAt",
                table: "Words");

            migrationBuilder.DropColumn(
                name: "Published",
                table: "Words");

            migrationBuilder.AddColumn<string>(
                name: "DeckTitleVi",
                table: "Words",
                type: "text",
                nullable: false,
                defaultValue: "");
        }
    }
}
