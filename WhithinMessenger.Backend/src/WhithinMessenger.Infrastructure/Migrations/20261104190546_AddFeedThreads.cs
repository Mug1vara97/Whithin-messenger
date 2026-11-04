using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace WhithinMessenger.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddFeedThreads : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Title",
                table: "FeedPosts",
                type: "character varying(300)",
                maxLength: 300,
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "ParentCommentId",
                table: "FeedPostComments",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "FeedCommentReactions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    FeedPostCommentId = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    Value = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FeedCommentReactions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_FeedCommentReactions_AspNetUsers_UserId",
                        column: x => x.UserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_FeedCommentReactions_FeedPostComments_FeedPostCommentId",
                        column: x => x.FeedPostCommentId,
                        principalTable: "FeedPostComments",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_FeedPostComments_ParentCommentId",
                table: "FeedPostComments",
                column: "ParentCommentId");

            migrationBuilder.CreateIndex(
                name: "IX_FeedCommentReactions_FeedPostCommentId",
                table: "FeedCommentReactions",
                column: "FeedPostCommentId");

            migrationBuilder.CreateIndex(
                name: "IX_FeedCommentReactions_FeedPostCommentId_UserId",
                table: "FeedCommentReactions",
                columns: new[] { "FeedPostCommentId", "UserId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_FeedCommentReactions_UserId",
                table: "FeedCommentReactions",
                column: "UserId");

            migrationBuilder.AddForeignKey(
                name: "FK_FeedPostComments_FeedPostComments_ParentCommentId",
                table: "FeedPostComments",
                column: "ParentCommentId",
                principalTable: "FeedPostComments",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_FeedPostComments_FeedPostComments_ParentCommentId",
                table: "FeedPostComments");

            migrationBuilder.DropTable(
                name: "FeedCommentReactions");

            migrationBuilder.DropIndex(
                name: "IX_FeedPostComments_ParentCommentId",
                table: "FeedPostComments");

            migrationBuilder.DropColumn(
                name: "Title",
                table: "FeedPosts");

            migrationBuilder.DropColumn(
                name: "ParentCommentId",
                table: "FeedPostComments");
        }
    }
}
