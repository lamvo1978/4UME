using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FourUme.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class ConversationAddonQuota : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "ConversationAddonUntil",
                table: "Users",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SessionKind",
                table: "Conversations",
                type: "character varying(16)",
                maxLength: 16,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ConversationAddonUntil",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "SessionKind",
                table: "Conversations");
        }
    }
}
