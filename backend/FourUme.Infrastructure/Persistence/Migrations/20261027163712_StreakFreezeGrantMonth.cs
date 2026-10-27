using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FourUme.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class StreakFreezeGrantMonth : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "StreakFreezeGrantMonth",
                table: "Users",
                type: "integer",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "StreakFreezeGrantMonth",
                table: "Users");
        }
    }
}
