using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FourUme.Infrastructure.Persistence.Migrations
{
    /// <summary>The protected owner account moves from admin@4ume.com to admin@4ume.io.vn.</summary>
    public partial class RenameOwnerEmail : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                UPDATE "Users" SET "Email" = 'admin@4ume.io.vn'
                WHERE lower("Email") = 'admin@4ume.com'
                  AND NOT EXISTS (SELECT 1 FROM "Users" WHERE lower("Email") = 'admin@4ume.io.vn');
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                UPDATE "Users" SET "Email" = 'admin@4ume.com'
                WHERE lower("Email") = 'admin@4ume.io.vn'
                  AND NOT EXISTS (SELECT 1 FROM "Users" WHERE lower("Email") = 'admin@4ume.com');
                """);
        }
    }
}
