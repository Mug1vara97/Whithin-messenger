using System;
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
            migrationBuilder.InsertData(
                table: "ChatTypes",
                columns: new[] { "Id", "TypeName" },
                values: new object[] { new Guid("66666666-6666-6666-6666-666666666666"), "Saved" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DeleteData(
                table: "ChatTypes",
                keyColumn: "Id",
                keyValue: new Guid("66666666-6666-6666-6666-666666666666"));
        }
    }
}
