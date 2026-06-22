using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace WhithinMessenger.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class FixSavedMessagesChatTypeId : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Saved ChatType seeding is handled idempotently in SavedMessagesChatTypeDataFix
            // so IdeasBoard can be renamed before inserting the Saved type (unique TypeName index).
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
        }
    }
}
