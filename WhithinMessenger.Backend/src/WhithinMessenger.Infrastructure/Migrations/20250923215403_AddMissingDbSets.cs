using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace WhithinMessenger.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddMissingDbSets : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_AuditLog_AspNetUsers_UserId",
                table: "AuditLog");

            migrationBuilder.DropForeignKey(
                name: "FK_AuditLog_Server_ServerId",
                table: "AuditLog");

            migrationBuilder.DropForeignKey(
                name: "FK_Chat_ChatCategory_CategoryId",
                table: "Chat");

            migrationBuilder.DropForeignKey(
                name: "FK_Chat_ChatType_TypeId",
                table: "Chat");

            migrationBuilder.DropForeignKey(
                name: "FK_Chat_Server_ServerId",
                table: "Chat");

            migrationBuilder.DropForeignKey(
                name: "FK_ChatCategory_Server_ServerId",
                table: "ChatCategory");

            migrationBuilder.DropForeignKey(
                name: "FK_Member_AspNetUsers_UserId",
                table: "Member");

            migrationBuilder.DropForeignKey(
                name: "FK_Member_Chat_ChatId",
                table: "Member");

            migrationBuilder.DropForeignKey(
                name: "FK_Message_AspNetUsers_ForwardedByUserId",
                table: "Message");

            migrationBuilder.DropForeignKey(
                name: "FK_Message_AspNetUsers_UserId",
                table: "Message");

            migrationBuilder.DropForeignKey(
                name: "FK_Message_Chat_ChatId",
                table: "Message");

            migrationBuilder.DropForeignKey(
                name: "FK_Message_Chat_ForwardedFromChatId",
                table: "Message");

            migrationBuilder.DropForeignKey(
                name: "FK_Message_Message_ForwardedFromMessageId",
                table: "Message");

            migrationBuilder.DropForeignKey(
                name: "FK_Message_Message_RepliedToMessageId",
                table: "Message");

            migrationBuilder.DropForeignKey(
                name: "FK_MessageRead_AspNetUsers_UserId",
                table: "MessageRead");

            migrationBuilder.DropForeignKey(
                name: "FK_MessageRead_Message_MessageId",
                table: "MessageRead");

            migrationBuilder.DropForeignKey(
                name: "FK_Notification_AspNetUsers_UserId",
                table: "Notification");

            migrationBuilder.DropForeignKey(
                name: "FK_Notification_Chat_ChatId",
                table: "Notification");

            migrationBuilder.DropForeignKey(
                name: "FK_Notification_Message_MessageId",
                table: "Notification");

            migrationBuilder.DropForeignKey(
                name: "FK_RefreshToken_AspNetUsers_UserId",
                table: "RefreshToken");

            migrationBuilder.DropForeignKey(
                name: "FK_Server_AspNetUsers_OwnerId",
                table: "Server");

            migrationBuilder.DropForeignKey(
                name: "FK_ServerAuditLog_AspNetUsers_UserId",
                table: "ServerAuditLog");

            migrationBuilder.DropForeignKey(
                name: "FK_ServerAuditLog_Server_ServerId",
                table: "ServerAuditLog");

            migrationBuilder.DropForeignKey(
                name: "FK_ServerMember_AspNetUsers_UserId",
                table: "ServerMember");

            migrationBuilder.DropForeignKey(
                name: "FK_ServerMember_Server_ServerId",
                table: "ServerMember");

            migrationBuilder.DropForeignKey(
                name: "FK_ServerRole_Server_ServerId",
                table: "ServerRole");

            migrationBuilder.DropForeignKey(
                name: "FK_UserProfile_AspNetUsers_UserId",
                table: "UserProfile");

            migrationBuilder.DropForeignKey(
                name: "FK_UserServerOrder_AspNetUsers_UserId",
                table: "UserServerOrder");

            migrationBuilder.DropForeignKey(
                name: "FK_UserServerOrder_Server_ServerId",
                table: "UserServerOrder");

            migrationBuilder.DropForeignKey(
                name: "FK_UserServerRole_AspNetUsers_Id",
                table: "UserServerRole");

            migrationBuilder.DropForeignKey(
                name: "FK_UserServerRole_ServerRole_RoleId",
                table: "UserServerRole");

            migrationBuilder.DropForeignKey(
                name: "FK_UserServerRole_Server_ServerId",
                table: "UserServerRole");

            migrationBuilder.DropPrimaryKey(
                name: "PK_UserServerRole",
                table: "UserServerRole");

            migrationBuilder.DropPrimaryKey(
                name: "PK_UserServerOrder",
                table: "UserServerOrder");

            migrationBuilder.DropPrimaryKey(
                name: "PK_UserProfile",
                table: "UserProfile");

            migrationBuilder.DropPrimaryKey(
                name: "PK_ServerRole",
                table: "ServerRole");

            migrationBuilder.DropPrimaryKey(
                name: "PK_ServerMember",
                table: "ServerMember");

            migrationBuilder.DropPrimaryKey(
                name: "PK_ServerAuditLog",
                table: "ServerAuditLog");

            migrationBuilder.DropPrimaryKey(
                name: "PK_Server",
                table: "Server");

            migrationBuilder.DropPrimaryKey(
                name: "PK_RefreshToken",
                table: "RefreshToken");

            migrationBuilder.DropPrimaryKey(
                name: "PK_Notification",
                table: "Notification");

            migrationBuilder.DropPrimaryKey(
                name: "PK_MessageRead",
                table: "MessageRead");

            migrationBuilder.DropPrimaryKey(
                name: "PK_Message",
                table: "Message");

            migrationBuilder.DropPrimaryKey(
                name: "PK_Member",
                table: "Member");

            migrationBuilder.DropPrimaryKey(
                name: "PK_ChatType",
                table: "ChatType");

            migrationBuilder.DropPrimaryKey(
                name: "PK_ChatCategory",
                table: "ChatCategory");

            migrationBuilder.DropPrimaryKey(
                name: "PK_Chat",
                table: "Chat");

            migrationBuilder.DropPrimaryKey(
                name: "PK_AuditLog",
                table: "AuditLog");

            migrationBuilder.RenameTable(
                name: "UserServerRole",
                newName: "UserServerRoles");

            migrationBuilder.RenameTable(
                name: "UserServerOrder",
                newName: "UserServerOrders");

            migrationBuilder.RenameTable(
                name: "UserProfile",
                newName: "UserProfiles");

            migrationBuilder.RenameTable(
                name: "ServerRole",
                newName: "ServerRoles");

            migrationBuilder.RenameTable(
                name: "ServerMember",
                newName: "ServerMembers");

            migrationBuilder.RenameTable(
                name: "ServerAuditLog",
                newName: "ServerAuditLogs");

            migrationBuilder.RenameTable(
                name: "Server",
                newName: "Servers");

            migrationBuilder.RenameTable(
                name: "RefreshToken",
                newName: "RefreshTokens");

            migrationBuilder.RenameTable(
                name: "Notification",
                newName: "Notifications");

            migrationBuilder.RenameTable(
                name: "MessageRead",
                newName: "MessageReads");

            migrationBuilder.RenameTable(
                name: "Message",
                newName: "Messages");

            migrationBuilder.RenameTable(
                name: "Member",
                newName: "Members");

            migrationBuilder.RenameTable(
                name: "ChatType",
                newName: "ChatTypes");

            migrationBuilder.RenameTable(
                name: "ChatCategory",
                newName: "ChatCategories");

            migrationBuilder.RenameTable(
                name: "Chat",
                newName: "Chats");

            migrationBuilder.RenameTable(
                name: "AuditLog",
                newName: "AuditLogs");

            migrationBuilder.RenameIndex(
                name: "IX_UserServerRole_ServerId",
                table: "UserServerRoles",
                newName: "IX_UserServerRoles_ServerId");

            migrationBuilder.RenameIndex(
                name: "IX_UserServerRole_RoleId",
                table: "UserServerRoles",
                newName: "IX_UserServerRoles_RoleId");

            migrationBuilder.RenameIndex(
                name: "IX_UserServerOrder_UserId",
                table: "UserServerOrders",
                newName: "IX_UserServerOrders_UserId");

            migrationBuilder.RenameIndex(
                name: "IX_UserServerOrder_ServerId",
                table: "UserServerOrders",
                newName: "IX_UserServerOrders_ServerId");

            migrationBuilder.RenameIndex(
                name: "IX_ServerMember_UserId",
                table: "ServerMembers",
                newName: "IX_ServerMembers_UserId");

            migrationBuilder.RenameIndex(
                name: "IX_ServerAuditLog_UserId",
                table: "ServerAuditLogs",
                newName: "IX_ServerAuditLogs_UserId");

            migrationBuilder.RenameIndex(
                name: "IX_ServerAuditLog_ServerId",
                table: "ServerAuditLogs",
                newName: "IX_ServerAuditLogs_ServerId");

            migrationBuilder.RenameIndex(
                name: "IX_Server_OwnerId",
                table: "Servers",
                newName: "IX_Servers_OwnerId");

            migrationBuilder.RenameIndex(
                name: "IX_RefreshToken_UserId",
                table: "RefreshTokens",
                newName: "IX_RefreshTokens_UserId");

            migrationBuilder.RenameIndex(
                name: "IX_RefreshToken_Token",
                table: "RefreshTokens",
                newName: "IX_RefreshTokens_Token");

            migrationBuilder.RenameIndex(
                name: "IX_Notification_UserId",
                table: "Notifications",
                newName: "IX_Notifications_UserId");

            migrationBuilder.RenameIndex(
                name: "IX_Notification_MessageId",
                table: "Notifications",
                newName: "IX_Notifications_MessageId");

            migrationBuilder.RenameIndex(
                name: "IX_Notification_ChatId",
                table: "Notifications",
                newName: "IX_Notifications_ChatId");

            migrationBuilder.RenameIndex(
                name: "IX_MessageRead_UserId",
                table: "MessageReads",
                newName: "IX_MessageReads_UserId");

            migrationBuilder.RenameIndex(
                name: "IX_Message_UserId",
                table: "Messages",
                newName: "IX_Messages_UserId");

            migrationBuilder.RenameIndex(
                name: "IX_Message_RepliedToMessageId",
                table: "Messages",
                newName: "IX_Messages_RepliedToMessageId");

            migrationBuilder.RenameIndex(
                name: "IX_Message_ForwardedFromMessageId",
                table: "Messages",
                newName: "IX_Messages_ForwardedFromMessageId");

            migrationBuilder.RenameIndex(
                name: "IX_Message_ForwardedFromChatId",
                table: "Messages",
                newName: "IX_Messages_ForwardedFromChatId");

            migrationBuilder.RenameIndex(
                name: "IX_Message_ForwardedByUserId",
                table: "Messages",
                newName: "IX_Messages_ForwardedByUserId");

            migrationBuilder.RenameIndex(
                name: "IX_Message_ChatId",
                table: "Messages",
                newName: "IX_Messages_ChatId");

            migrationBuilder.RenameIndex(
                name: "IX_Member_ChatId",
                table: "Members",
                newName: "IX_Members_ChatId");

            migrationBuilder.RenameIndex(
                name: "IX_ChatCategory_ServerId",
                table: "ChatCategories",
                newName: "IX_ChatCategories_ServerId");

            migrationBuilder.RenameIndex(
                name: "IX_Chat_TypeId",
                table: "Chats",
                newName: "IX_Chats_TypeId");

            migrationBuilder.RenameIndex(
                name: "IX_Chat_ServerId",
                table: "Chats",
                newName: "IX_Chats_ServerId");

            migrationBuilder.RenameIndex(
                name: "IX_Chat_CategoryId",
                table: "Chats",
                newName: "IX_Chats_CategoryId");

            migrationBuilder.RenameIndex(
                name: "IX_AuditLog_UserId",
                table: "AuditLogs",
                newName: "IX_AuditLogs_UserId");

            migrationBuilder.RenameIndex(
                name: "IX_AuditLog_ServerId",
                table: "AuditLogs",
                newName: "IX_AuditLogs_ServerId");

            migrationBuilder.AddPrimaryKey(
                name: "PK_UserServerRoles",
                table: "UserServerRoles",
                columns: new[] { "Id", "ServerId", "RoleId" });

            migrationBuilder.AddPrimaryKey(
                name: "PK_UserServerOrders",
                table: "UserServerOrders",
                column: "Id");

            migrationBuilder.AddPrimaryKey(
                name: "PK_UserProfiles",
                table: "UserProfiles",
                column: "Id");

            migrationBuilder.AddPrimaryKey(
                name: "PK_ServerRoles",
                table: "ServerRoles",
                column: "Id");

            migrationBuilder.AddPrimaryKey(
                name: "PK_ServerMembers",
                table: "ServerMembers",
                column: "Id");

            migrationBuilder.AddPrimaryKey(
                name: "PK_ServerAuditLogs",
                table: "ServerAuditLogs",
                column: "Id");

            migrationBuilder.AddPrimaryKey(
                name: "PK_Servers",
                table: "Servers",
                column: "Id");

            migrationBuilder.AddPrimaryKey(
                name: "PK_RefreshTokens",
                table: "RefreshTokens",
                column: "Id");

            migrationBuilder.AddPrimaryKey(
                name: "PK_Notifications",
                table: "Notifications",
                column: "Id");

            migrationBuilder.AddPrimaryKey(
                name: "PK_MessageReads",
                table: "MessageReads",
                column: "Id");

            migrationBuilder.AddPrimaryKey(
                name: "PK_Messages",
                table: "Messages",
                column: "Id");

            migrationBuilder.AddPrimaryKey(
                name: "PK_Members",
                table: "Members",
                column: "Id");

            migrationBuilder.AddPrimaryKey(
                name: "PK_ChatTypes",
                table: "ChatTypes",
                column: "Id");

            migrationBuilder.AddPrimaryKey(
                name: "PK_ChatCategories",
                table: "ChatCategories",
                column: "Id");

            migrationBuilder.AddPrimaryKey(
                name: "PK_Chats",
                table: "Chats",
                column: "Id");

            migrationBuilder.AddPrimaryKey(
                name: "PK_AuditLogs",
                table: "AuditLogs",
                column: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_AuditLogs_AspNetUsers_UserId",
                table: "AuditLogs",
                column: "UserId",
                principalTable: "AspNetUsers",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_AuditLogs_Servers_ServerId",
                table: "AuditLogs",
                column: "ServerId",
                principalTable: "Servers",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_ChatCategories_Servers_ServerId",
                table: "ChatCategories",
                column: "ServerId",
                principalTable: "Servers",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_Chats_ChatCategories_CategoryId",
                table: "Chats",
                column: "CategoryId",
                principalTable: "ChatCategories",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_Chats_ChatTypes_TypeId",
                table: "Chats",
                column: "TypeId",
                principalTable: "ChatTypes",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_Chats_Servers_ServerId",
                table: "Chats",
                column: "ServerId",
                principalTable: "Servers",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_Members_AspNetUsers_UserId",
                table: "Members",
                column: "UserId",
                principalTable: "AspNetUsers",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_Members_Chats_ChatId",
                table: "Members",
                column: "ChatId",
                principalTable: "Chats",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_MessageReads_AspNetUsers_UserId",
                table: "MessageReads",
                column: "UserId",
                principalTable: "AspNetUsers",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_MessageReads_Messages_MessageId",
                table: "MessageReads",
                column: "MessageId",
                principalTable: "Messages",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_Messages_AspNetUsers_ForwardedByUserId",
                table: "Messages",
                column: "ForwardedByUserId",
                principalTable: "AspNetUsers",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_Messages_AspNetUsers_UserId",
                table: "Messages",
                column: "UserId",
                principalTable: "AspNetUsers",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_Messages_Chats_ChatId",
                table: "Messages",
                column: "ChatId",
                principalTable: "Chats",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_Messages_Chats_ForwardedFromChatId",
                table: "Messages",
                column: "ForwardedFromChatId",
                principalTable: "Chats",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_Messages_Messages_ForwardedFromMessageId",
                table: "Messages",
                column: "ForwardedFromMessageId",
                principalTable: "Messages",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_Messages_Messages_RepliedToMessageId",
                table: "Messages",
                column: "RepliedToMessageId",
                principalTable: "Messages",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_Notifications_AspNetUsers_UserId",
                table: "Notifications",
                column: "UserId",
                principalTable: "AspNetUsers",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_Notifications_Chats_ChatId",
                table: "Notifications",
                column: "ChatId",
                principalTable: "Chats",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_Notifications_Messages_MessageId",
                table: "Notifications",
                column: "MessageId",
                principalTable: "Messages",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_RefreshTokens_AspNetUsers_UserId",
                table: "RefreshTokens",
                column: "UserId",
                principalTable: "AspNetUsers",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_ServerAuditLogs_AspNetUsers_UserId",
                table: "ServerAuditLogs",
                column: "UserId",
                principalTable: "AspNetUsers",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_ServerAuditLogs_Servers_ServerId",
                table: "ServerAuditLogs",
                column: "ServerId",
                principalTable: "Servers",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_ServerMembers_AspNetUsers_UserId",
                table: "ServerMembers",
                column: "UserId",
                principalTable: "AspNetUsers",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_ServerMembers_Servers_ServerId",
                table: "ServerMembers",
                column: "ServerId",
                principalTable: "Servers",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_ServerRoles_Servers_ServerId",
                table: "ServerRoles",
                column: "ServerId",
                principalTable: "Servers",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_Servers_AspNetUsers_OwnerId",
                table: "Servers",
                column: "OwnerId",
                principalTable: "AspNetUsers",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_UserProfiles_AspNetUsers_UserId",
                table: "UserProfiles",
                column: "UserId",
                principalTable: "AspNetUsers",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_UserServerOrders_AspNetUsers_UserId",
                table: "UserServerOrders",
                column: "UserId",
                principalTable: "AspNetUsers",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_UserServerOrders_Servers_ServerId",
                table: "UserServerOrders",
                column: "ServerId",
                principalTable: "Servers",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_UserServerRoles_AspNetUsers_Id",
                table: "UserServerRoles",
                column: "Id",
                principalTable: "AspNetUsers",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_UserServerRoles_ServerRoles_RoleId",
                table: "UserServerRoles",
                column: "RoleId",
                principalTable: "ServerRoles",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_UserServerRoles_Servers_ServerId",
                table: "UserServerRoles",
                column: "ServerId",
                principalTable: "Servers",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_AuditLogs_AspNetUsers_UserId",
                table: "AuditLogs");

            migrationBuilder.DropForeignKey(
                name: "FK_AuditLogs_Servers_ServerId",
                table: "AuditLogs");

            migrationBuilder.DropForeignKey(
                name: "FK_ChatCategories_Servers_ServerId",
                table: "ChatCategories");

            migrationBuilder.DropForeignKey(
                name: "FK_Chats_ChatCategories_CategoryId",
                table: "Chats");

            migrationBuilder.DropForeignKey(
                name: "FK_Chats_ChatTypes_TypeId",
                table: "Chats");

            migrationBuilder.DropForeignKey(
                name: "FK_Chats_Servers_ServerId",
                table: "Chats");

            migrationBuilder.DropForeignKey(
                name: "FK_Members_AspNetUsers_UserId",
                table: "Members");

            migrationBuilder.DropForeignKey(
                name: "FK_Members_Chats_ChatId",
                table: "Members");

            migrationBuilder.DropForeignKey(
                name: "FK_MessageReads_AspNetUsers_UserId",
                table: "MessageReads");

            migrationBuilder.DropForeignKey(
                name: "FK_MessageReads_Messages_MessageId",
                table: "MessageReads");

            migrationBuilder.DropForeignKey(
                name: "FK_Messages_AspNetUsers_ForwardedByUserId",
                table: "Messages");

            migrationBuilder.DropForeignKey(
                name: "FK_Messages_AspNetUsers_UserId",
                table: "Messages");

            migrationBuilder.DropForeignKey(
                name: "FK_Messages_Chats_ChatId",
                table: "Messages");

            migrationBuilder.DropForeignKey(
                name: "FK_Messages_Chats_ForwardedFromChatId",
                table: "Messages");

            migrationBuilder.DropForeignKey(
                name: "FK_Messages_Messages_ForwardedFromMessageId",
                table: "Messages");

            migrationBuilder.DropForeignKey(
                name: "FK_Messages_Messages_RepliedToMessageId",
                table: "Messages");

            migrationBuilder.DropForeignKey(
                name: "FK_Notifications_AspNetUsers_UserId",
                table: "Notifications");

            migrationBuilder.DropForeignKey(
                name: "FK_Notifications_Chats_ChatId",
                table: "Notifications");

            migrationBuilder.DropForeignKey(
                name: "FK_Notifications_Messages_MessageId",
                table: "Notifications");

            migrationBuilder.DropForeignKey(
                name: "FK_RefreshTokens_AspNetUsers_UserId",
                table: "RefreshTokens");

            migrationBuilder.DropForeignKey(
                name: "FK_ServerAuditLogs_AspNetUsers_UserId",
                table: "ServerAuditLogs");

            migrationBuilder.DropForeignKey(
                name: "FK_ServerAuditLogs_Servers_ServerId",
                table: "ServerAuditLogs");

            migrationBuilder.DropForeignKey(
                name: "FK_ServerMembers_AspNetUsers_UserId",
                table: "ServerMembers");

            migrationBuilder.DropForeignKey(
                name: "FK_ServerMembers_Servers_ServerId",
                table: "ServerMembers");

            migrationBuilder.DropForeignKey(
                name: "FK_ServerRoles_Servers_ServerId",
                table: "ServerRoles");

            migrationBuilder.DropForeignKey(
                name: "FK_Servers_AspNetUsers_OwnerId",
                table: "Servers");

            migrationBuilder.DropForeignKey(
                name: "FK_UserProfiles_AspNetUsers_UserId",
                table: "UserProfiles");

            migrationBuilder.DropForeignKey(
                name: "FK_UserServerOrders_AspNetUsers_UserId",
                table: "UserServerOrders");

            migrationBuilder.DropForeignKey(
                name: "FK_UserServerOrders_Servers_ServerId",
                table: "UserServerOrders");

            migrationBuilder.DropForeignKey(
                name: "FK_UserServerRoles_AspNetUsers_Id",
                table: "UserServerRoles");

            migrationBuilder.DropForeignKey(
                name: "FK_UserServerRoles_ServerRoles_RoleId",
                table: "UserServerRoles");

            migrationBuilder.DropForeignKey(
                name: "FK_UserServerRoles_Servers_ServerId",
                table: "UserServerRoles");

            migrationBuilder.DropPrimaryKey(
                name: "PK_UserServerRoles",
                table: "UserServerRoles");

            migrationBuilder.DropPrimaryKey(
                name: "PK_UserServerOrders",
                table: "UserServerOrders");

            migrationBuilder.DropPrimaryKey(
                name: "PK_UserProfiles",
                table: "UserProfiles");

            migrationBuilder.DropPrimaryKey(
                name: "PK_Servers",
                table: "Servers");

            migrationBuilder.DropPrimaryKey(
                name: "PK_ServerRoles",
                table: "ServerRoles");

            migrationBuilder.DropPrimaryKey(
                name: "PK_ServerMembers",
                table: "ServerMembers");

            migrationBuilder.DropPrimaryKey(
                name: "PK_ServerAuditLogs",
                table: "ServerAuditLogs");

            migrationBuilder.DropPrimaryKey(
                name: "PK_RefreshTokens",
                table: "RefreshTokens");

            migrationBuilder.DropPrimaryKey(
                name: "PK_Notifications",
                table: "Notifications");

            migrationBuilder.DropPrimaryKey(
                name: "PK_Messages",
                table: "Messages");

            migrationBuilder.DropPrimaryKey(
                name: "PK_MessageReads",
                table: "MessageReads");

            migrationBuilder.DropPrimaryKey(
                name: "PK_Members",
                table: "Members");

            migrationBuilder.DropPrimaryKey(
                name: "PK_ChatTypes",
                table: "ChatTypes");

            migrationBuilder.DropPrimaryKey(
                name: "PK_Chats",
                table: "Chats");

            migrationBuilder.DropPrimaryKey(
                name: "PK_ChatCategories",
                table: "ChatCategories");

            migrationBuilder.DropPrimaryKey(
                name: "PK_AuditLogs",
                table: "AuditLogs");

            migrationBuilder.RenameTable(
                name: "UserServerRoles",
                newName: "UserServerRole");

            migrationBuilder.RenameTable(
                name: "UserServerOrders",
                newName: "UserServerOrder");

            migrationBuilder.RenameTable(
                name: "UserProfiles",
                newName: "UserProfile");

            migrationBuilder.RenameTable(
                name: "Servers",
                newName: "Server");

            migrationBuilder.RenameTable(
                name: "ServerRoles",
                newName: "ServerRole");

            migrationBuilder.RenameTable(
                name: "ServerMembers",
                newName: "ServerMember");

            migrationBuilder.RenameTable(
                name: "ServerAuditLogs",
                newName: "ServerAuditLog");

            migrationBuilder.RenameTable(
                name: "RefreshTokens",
                newName: "RefreshToken");

            migrationBuilder.RenameTable(
                name: "Notifications",
                newName: "Notification");

            migrationBuilder.RenameTable(
                name: "Messages",
                newName: "Message");

            migrationBuilder.RenameTable(
                name: "MessageReads",
                newName: "MessageRead");

            migrationBuilder.RenameTable(
                name: "Members",
                newName: "Member");

            migrationBuilder.RenameTable(
                name: "ChatTypes",
                newName: "ChatType");

            migrationBuilder.RenameTable(
                name: "Chats",
                newName: "Chat");

            migrationBuilder.RenameTable(
                name: "ChatCategories",
                newName: "ChatCategory");

            migrationBuilder.RenameTable(
                name: "AuditLogs",
                newName: "AuditLog");

            migrationBuilder.RenameIndex(
                name: "IX_UserServerRoles_ServerId",
                table: "UserServerRole",
                newName: "IX_UserServerRole_ServerId");

            migrationBuilder.RenameIndex(
                name: "IX_UserServerRoles_RoleId",
                table: "UserServerRole",
                newName: "IX_UserServerRole_RoleId");

            migrationBuilder.RenameIndex(
                name: "IX_UserServerOrders_UserId",
                table: "UserServerOrder",
                newName: "IX_UserServerOrder_UserId");

            migrationBuilder.RenameIndex(
                name: "IX_UserServerOrders_ServerId",
                table: "UserServerOrder",
                newName: "IX_UserServerOrder_ServerId");

            migrationBuilder.RenameIndex(
                name: "IX_Servers_OwnerId",
                table: "Server",
                newName: "IX_Server_OwnerId");

            migrationBuilder.RenameIndex(
                name: "IX_ServerMembers_UserId",
                table: "ServerMember",
                newName: "IX_ServerMember_UserId");

            migrationBuilder.RenameIndex(
                name: "IX_ServerAuditLogs_UserId",
                table: "ServerAuditLog",
                newName: "IX_ServerAuditLog_UserId");

            migrationBuilder.RenameIndex(
                name: "IX_ServerAuditLogs_ServerId",
                table: "ServerAuditLog",
                newName: "IX_ServerAuditLog_ServerId");

            migrationBuilder.RenameIndex(
                name: "IX_RefreshTokens_UserId",
                table: "RefreshToken",
                newName: "IX_RefreshToken_UserId");

            migrationBuilder.RenameIndex(
                name: "IX_RefreshTokens_Token",
                table: "RefreshToken",
                newName: "IX_RefreshToken_Token");

            migrationBuilder.RenameIndex(
                name: "IX_Notifications_UserId",
                table: "Notification",
                newName: "IX_Notification_UserId");

            migrationBuilder.RenameIndex(
                name: "IX_Notifications_MessageId",
                table: "Notification",
                newName: "IX_Notification_MessageId");

            migrationBuilder.RenameIndex(
                name: "IX_Notifications_ChatId",
                table: "Notification",
                newName: "IX_Notification_ChatId");

            migrationBuilder.RenameIndex(
                name: "IX_Messages_UserId",
                table: "Message",
                newName: "IX_Message_UserId");

            migrationBuilder.RenameIndex(
                name: "IX_Messages_RepliedToMessageId",
                table: "Message",
                newName: "IX_Message_RepliedToMessageId");

            migrationBuilder.RenameIndex(
                name: "IX_Messages_ForwardedFromMessageId",
                table: "Message",
                newName: "IX_Message_ForwardedFromMessageId");

            migrationBuilder.RenameIndex(
                name: "IX_Messages_ForwardedFromChatId",
                table: "Message",
                newName: "IX_Message_ForwardedFromChatId");

            migrationBuilder.RenameIndex(
                name: "IX_Messages_ForwardedByUserId",
                table: "Message",
                newName: "IX_Message_ForwardedByUserId");

            migrationBuilder.RenameIndex(
                name: "IX_Messages_ChatId",
                table: "Message",
                newName: "IX_Message_ChatId");

            migrationBuilder.RenameIndex(
                name: "IX_MessageReads_UserId",
                table: "MessageRead",
                newName: "IX_MessageRead_UserId");

            migrationBuilder.RenameIndex(
                name: "IX_Members_ChatId",
                table: "Member",
                newName: "IX_Member_ChatId");

            migrationBuilder.RenameIndex(
                name: "IX_Chats_TypeId",
                table: "Chat",
                newName: "IX_Chat_TypeId");

            migrationBuilder.RenameIndex(
                name: "IX_Chats_ServerId",
                table: "Chat",
                newName: "IX_Chat_ServerId");

            migrationBuilder.RenameIndex(
                name: "IX_Chats_CategoryId",
                table: "Chat",
                newName: "IX_Chat_CategoryId");

            migrationBuilder.RenameIndex(
                name: "IX_ChatCategories_ServerId",
                table: "ChatCategory",
                newName: "IX_ChatCategory_ServerId");

            migrationBuilder.RenameIndex(
                name: "IX_AuditLogs_UserId",
                table: "AuditLog",
                newName: "IX_AuditLog_UserId");

            migrationBuilder.RenameIndex(
                name: "IX_AuditLogs_ServerId",
                table: "AuditLog",
                newName: "IX_AuditLog_ServerId");

            migrationBuilder.AddPrimaryKey(
                name: "PK_UserServerRole",
                table: "UserServerRole",
                columns: new[] { "Id", "ServerId", "RoleId" });

            migrationBuilder.AddPrimaryKey(
                name: "PK_UserServerOrder",
                table: "UserServerOrder",
                column: "Id");

            migrationBuilder.AddPrimaryKey(
                name: "PK_UserProfile",
                table: "UserProfile",
                column: "Id");

            migrationBuilder.AddPrimaryKey(
                name: "PK_Server",
                table: "Server",
                column: "Id");

            migrationBuilder.AddPrimaryKey(
                name: "PK_ServerRole",
                table: "ServerRole",
                column: "Id");

            migrationBuilder.AddPrimaryKey(
                name: "PK_ServerMember",
                table: "ServerMember",
                column: "Id");

            migrationBuilder.AddPrimaryKey(
                name: "PK_ServerAuditLog",
                table: "ServerAuditLog",
                column: "Id");

            migrationBuilder.AddPrimaryKey(
                name: "PK_RefreshToken",
                table: "RefreshToken",
                column: "Id");

            migrationBuilder.AddPrimaryKey(
                name: "PK_Notification",
                table: "Notification",
                column: "Id");

            migrationBuilder.AddPrimaryKey(
                name: "PK_Message",
                table: "Message",
                column: "Id");

            migrationBuilder.AddPrimaryKey(
                name: "PK_MessageRead",
                table: "MessageRead",
                column: "Id");

            migrationBuilder.AddPrimaryKey(
                name: "PK_Member",
                table: "Member",
                column: "Id");

            migrationBuilder.AddPrimaryKey(
                name: "PK_ChatType",
                table: "ChatType",
                column: "Id");

            migrationBuilder.AddPrimaryKey(
                name: "PK_Chat",
                table: "Chat",
                column: "Id");

            migrationBuilder.AddPrimaryKey(
                name: "PK_ChatCategory",
                table: "ChatCategory",
                column: "Id");

            migrationBuilder.AddPrimaryKey(
                name: "PK_AuditLog",
                table: "AuditLog",
                column: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_AuditLog_AspNetUsers_UserId",
                table: "AuditLog",
                column: "UserId",
                principalTable: "AspNetUsers",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_AuditLog_Server_ServerId",
                table: "AuditLog",
                column: "ServerId",
                principalTable: "Server",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_Chat_ChatCategory_CategoryId",
                table: "Chat",
                column: "CategoryId",
                principalTable: "ChatCategory",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_Chat_ChatType_TypeId",
                table: "Chat",
                column: "TypeId",
                principalTable: "ChatType",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_Chat_Server_ServerId",
                table: "Chat",
                column: "ServerId",
                principalTable: "Server",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_ChatCategory_Server_ServerId",
                table: "ChatCategory",
                column: "ServerId",
                principalTable: "Server",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_Member_AspNetUsers_UserId",
                table: "Member",
                column: "UserId",
                principalTable: "AspNetUsers",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_Member_Chat_ChatId",
                table: "Member",
                column: "ChatId",
                principalTable: "Chat",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_Message_AspNetUsers_ForwardedByUserId",
                table: "Message",
                column: "ForwardedByUserId",
                principalTable: "AspNetUsers",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_Message_AspNetUsers_UserId",
                table: "Message",
                column: "UserId",
                principalTable: "AspNetUsers",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_Message_Chat_ChatId",
                table: "Message",
                column: "ChatId",
                principalTable: "Chat",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_Message_Chat_ForwardedFromChatId",
                table: "Message",
                column: "ForwardedFromChatId",
                principalTable: "Chat",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_Message_Message_ForwardedFromMessageId",
                table: "Message",
                column: "ForwardedFromMessageId",
                principalTable: "Message",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_Message_Message_RepliedToMessageId",
                table: "Message",
                column: "RepliedToMessageId",
                principalTable: "Message",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_MessageRead_AspNetUsers_UserId",
                table: "MessageRead",
                column: "UserId",
                principalTable: "AspNetUsers",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_MessageRead_Message_MessageId",
                table: "MessageRead",
                column: "MessageId",
                principalTable: "Message",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_Notification_AspNetUsers_UserId",
                table: "Notification",
                column: "UserId",
                principalTable: "AspNetUsers",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_Notification_Chat_ChatId",
                table: "Notification",
                column: "ChatId",
                principalTable: "Chat",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_Notification_Message_MessageId",
                table: "Notification",
                column: "MessageId",
                principalTable: "Message",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_RefreshToken_AspNetUsers_UserId",
                table: "RefreshToken",
                column: "UserId",
                principalTable: "AspNetUsers",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_Server_AspNetUsers_OwnerId",
                table: "Server",
                column: "OwnerId",
                principalTable: "AspNetUsers",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_ServerAuditLog_AspNetUsers_UserId",
                table: "ServerAuditLog",
                column: "UserId",
                principalTable: "AspNetUsers",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_ServerAuditLog_Server_ServerId",
                table: "ServerAuditLog",
                column: "ServerId",
                principalTable: "Server",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_ServerMember_AspNetUsers_UserId",
                table: "ServerMember",
                column: "UserId",
                principalTable: "AspNetUsers",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_ServerMember_Server_ServerId",
                table: "ServerMember",
                column: "ServerId",
                principalTable: "Server",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_ServerRole_Server_ServerId",
                table: "ServerRole",
                column: "ServerId",
                principalTable: "Server",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_UserProfile_AspNetUsers_UserId",
                table: "UserProfile",
                column: "UserId",
                principalTable: "AspNetUsers",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_UserServerOrder_AspNetUsers_UserId",
                table: "UserServerOrder",
                column: "UserId",
                principalTable: "AspNetUsers",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_UserServerOrder_Server_ServerId",
                table: "UserServerOrder",
                column: "ServerId",
                principalTable: "Server",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_UserServerRole_AspNetUsers_Id",
                table: "UserServerRole",
                column: "Id",
                principalTable: "AspNetUsers",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_UserServerRole_ServerRole_RoleId",
                table: "UserServerRole",
                column: "RoleId",
                principalTable: "ServerRole",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_UserServerRole_Server_ServerId",
                table: "UserServerRole",
                column: "ServerId",
                principalTable: "Server",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
