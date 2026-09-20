using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace WhithinMessenger.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddNewsChatType : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.InsertData(
                table: "ChatTypes",
                columns: new[] { "Id", "TypeName" },
                values: new object[] { new Guid("77777777-7777-7777-7777-777777777777"), "News" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DeleteData(
                table: "ChatTypes",
                keyColumn: "Id",
                keyValue: new Guid("77777777-7777-7777-7777-777777777777"));
        }
    }
}
