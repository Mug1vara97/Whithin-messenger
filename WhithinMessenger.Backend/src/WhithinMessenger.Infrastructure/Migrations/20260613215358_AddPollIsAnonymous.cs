using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace WhithinMessenger.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddPollIsAnonymous : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsAnonymous",
                table: "MessagePolls",
                type: "boolean",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "IsAnonymous",
                table: "MessagePolls");
        }
    }
}
