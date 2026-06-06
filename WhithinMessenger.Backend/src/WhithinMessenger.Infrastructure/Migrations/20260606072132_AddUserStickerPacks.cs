using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace WhithinMessenger.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddUserStickerPacks : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "UserStickerPacks",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    StickerPackId = table.Column<Guid>(type: "uuid", nullable: false),
                    InstalledAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserStickerPacks", x => x.Id);
                    table.ForeignKey(
                        name: "FK_UserStickerPacks_AspNetUsers_UserId",
                        column: x => x.UserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_UserStickerPacks_StickerPacks_StickerPackId",
                        column: x => x.StickerPackId,
                        principalTable: "StickerPacks",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_UserStickerPacks_StickerPackId",
                table: "UserStickerPacks",
                column: "StickerPackId");

            migrationBuilder.CreateIndex(
                name: "IX_UserStickerPacks_UserId",
                table: "UserStickerPacks",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_UserStickerPacks_UserId_StickerPackId",
                table: "UserStickerPacks",
                columns: new[] { "UserId", "StickerPackId" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "UserStickerPacks");
        }
    }
}
