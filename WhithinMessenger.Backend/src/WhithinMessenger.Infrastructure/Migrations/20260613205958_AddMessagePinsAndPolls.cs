using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace WhithinMessenger.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddMessagePinsAndPolls : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Messages_ChatId",
                table: "Messages");

            migrationBuilder.AddColumn<bool>(
                name: "IsPinned",
                table: "Messages",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "PinnedAt",
                table: "Messages",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "PinnedByUserId",
                table: "Messages",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "MessagePolls",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    MessageId = table.Column<Guid>(type: "uuid", nullable: false),
                    Question = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    AllowMultiple = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MessagePolls", x => x.Id);
                    table.ForeignKey(
                        name: "FK_MessagePolls_Messages_MessageId",
                        column: x => x.MessageId,
                        principalTable: "Messages",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "PollOptions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PollId = table.Column<Guid>(type: "uuid", nullable: false),
                    Text = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    SortOrder = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PollOptions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PollOptions_MessagePolls_PollId",
                        column: x => x.PollId,
                        principalTable: "MessagePolls",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "PollVotes",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PollOptionId = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PollVotes", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PollVotes_AspNetUsers_UserId",
                        column: x => x.UserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_PollVotes_PollOptions_PollOptionId",
                        column: x => x.PollOptionId,
                        principalTable: "PollOptions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Messages_ChatId_IsPinned",
                table: "Messages",
                columns: new[] { "ChatId", "IsPinned" });

            migrationBuilder.CreateIndex(
                name: "IX_Messages_PinnedByUserId",
                table: "Messages",
                column: "PinnedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_MessagePolls_MessageId",
                table: "MessagePolls",
                column: "MessageId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_PollOptions_PollId",
                table: "PollOptions",
                column: "PollId");

            migrationBuilder.CreateIndex(
                name: "IX_PollVotes_PollOptionId_UserId",
                table: "PollVotes",
                columns: new[] { "PollOptionId", "UserId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_PollVotes_UserId",
                table: "PollVotes",
                column: "UserId");

            migrationBuilder.AddForeignKey(
                name: "FK_Messages_AspNetUsers_PinnedByUserId",
                table: "Messages",
                column: "PinnedByUserId",
                principalTable: "AspNetUsers",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Messages_AspNetUsers_PinnedByUserId",
                table: "Messages");

            migrationBuilder.DropTable(
                name: "PollVotes");

            migrationBuilder.DropTable(
                name: "PollOptions");

            migrationBuilder.DropTable(
                name: "MessagePolls");

            migrationBuilder.DropIndex(
                name: "IX_Messages_ChatId_IsPinned",
                table: "Messages");

            migrationBuilder.DropIndex(
                name: "IX_Messages_PinnedByUserId",
                table: "Messages");

            migrationBuilder.DropColumn(
                name: "IsPinned",
                table: "Messages");

            migrationBuilder.DropColumn(
                name: "PinnedAt",
                table: "Messages");

            migrationBuilder.DropColumn(
                name: "PinnedByUserId",
                table: "Messages");

            migrationBuilder.CreateIndex(
                name: "IX_Messages_ChatId",
                table: "Messages",
                column: "ChatId");
        }
    }
}
