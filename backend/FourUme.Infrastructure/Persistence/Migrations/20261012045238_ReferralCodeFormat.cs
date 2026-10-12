using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FourUme.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class ReferralCodeFormat : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Six-character codes predate the prefixed format; they are recreated as "MB-XXXXXX" the next time they are shown.
            migrationBuilder.Sql("""UPDATE "Users" SET "ReferralCode" = NULL WHERE length("ReferralCode") <> 8;""");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {

        }
    }
}
