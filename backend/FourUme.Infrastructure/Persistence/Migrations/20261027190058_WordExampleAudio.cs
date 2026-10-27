using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FourUme.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class WordExampleAudio : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ExampleAudioText",
                table: "Words",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ExampleAudioUrl",
                table: "Words",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ExampleVoice",
                table: "Words",
                type: "character varying(64)",
                maxLength: 64,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ExampleAudioText",
                table: "Words");

            migrationBuilder.DropColumn(
                name: "ExampleAudioUrl",
                table: "Words");

            migrationBuilder.DropColumn(
                name: "ExampleVoice",
                table: "Words");
        }
    }
}
