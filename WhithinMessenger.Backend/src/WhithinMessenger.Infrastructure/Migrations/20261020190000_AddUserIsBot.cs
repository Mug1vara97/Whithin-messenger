using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace WhithinMessenger.Infrastructure.Migrations;

/// <inheritdoc />
public partial class AddUserIsBot : Migration
{
    /// <inheritdoc />
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        // Idempotent: production may already have the column from a manual fix,
        // and the previous hand-written migration had no Designer so EF never applied it.
        migrationBuilder.Sql("""
            ALTER TABLE "AspNetUsers"
            ADD COLUMN IF NOT EXISTS "IsBot" boolean NOT NULL DEFAULT FALSE;
            """);
    }

    /// <inheritdoc />
    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn(
            name: "IsBot",
            table: "AspNetUsers");
    }
}
