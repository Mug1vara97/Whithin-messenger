using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace WhithinMessenger.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddFeedPostEngagement : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "FeedPostComments",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    FeedPostId = table.Column<Guid>(type: "uuid", nullable: false),
                    AuthorUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    Text = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FeedPostComments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_FeedPostComments_AspNetUsers_AuthorUserId",
                        column: x => x.AuthorUserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_FeedPostComments_FeedPosts_FeedPostId",
                        column: x => x.FeedPostId,
                        principalTable: "FeedPosts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "FeedPostReactions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    FeedPostId = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    Value = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FeedPostReactions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_FeedPostReactions_AspNetUsers_UserId",
                        column: x => x.UserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_FeedPostReactions_FeedPosts_FeedPostId",
                        column: x => x.FeedPostId,
                        principalTable: "FeedPosts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_FeedPostComments_AuthorUserId",
                table: "FeedPostComments",
                column: "AuthorUserId");

            migrationBuilder.CreateIndex(
                name: "IX_FeedPostComments_FeedPostId_CreatedAt",
                table: "FeedPostComments",
                columns: new[] { "FeedPostId", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_FeedPostReactions_FeedPostId",
                table: "FeedPostReactions",
                column: "FeedPostId");

            migrationBuilder.CreateIndex(
                name: "IX_FeedPostReactions_FeedPostId_UserId",
                table: "FeedPostReactions",
                columns: new[] { "FeedPostId", "UserId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_FeedPostReactions_UserId",
                table: "FeedPostReactions",
                column: "UserId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "FeedPostComments");

            migrationBuilder.DropTable(
                name: "FeedPostReactions");
        }
    }
}
