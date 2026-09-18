using Microsoft.AspNetCore.SignalR;
using Microsoft.AspNetCore.Http;
using System.Text;
using System.Text.Json;
using MediatR;
using WhithinMessenger.Application.CommandsAndQueries.Chats.GetUserChats;
using WhithinMessenger.Application.CommandsAndQueries.Chats.CreatePrivateChat;
using WhithinMessenger.Application.CommandsAndQueries.Chats.CreateGroupChat;
using WhithinMessenger.Application.CommandsAndQueries.Chats.ReorderPinnedChats;
using WhithinMessenger.Application.CommandsAndQueries.Chats.SetChatPin;
using WhithinMessenger.Application.CommandsAndQueries.Users.SearchUsers;
using Microsoft.Extensions.Logging;
using System.Security.Claims;

namespace WhithinMessenger.Api.Hubs
{
    /// <summary>
    /// ChatList-домен единого хаба (бывший ChatListHub): список чатов, поиск, создание чатов, pin.
    /// Клиентские события этого домена исторически в нижнем регистре (receivechats, chatcreated, ...).
    /// </summary>
    public partial class AppHub
    {
        public async Task GetUserChats()
        {
            try
            {
                var userId = GetCurrentUserId();
                if (userId == null)
                {
                    _logger.LogWarning("ChatListHub: User not authorized");
                    await Clients.Caller.SendAsync("Error", "Пользователь не авторизован");
                    return;
                }

                var query = new GetUserChatsQuery(userId.Value);
                var result = await _mediator.Send(query);
                await Clients.Caller.SendAsync("receivechats", result.Chats);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "ChatListHub: Error getting user chats");
                await Clients.Caller.SendAsync("error", "Произошла ошибка при получении списка чатов: " + ex.Message);
            }
        }

        public async Task CreatePrivateChat(Guid targetUserId)
        {
            try
            {
                var userId = GetCurrentUserId();
                if (userId == null)
                {
                    await Clients.Caller.SendAsync("Error", "Пользователь не авторизован");
                    return;
                }

                var command = new CreatePrivateChatCommand(userId.Value, targetUserId);
                var result = await _mediator.Send(command);
                
                if (result.Success)
                {
                    await Clients.Caller.SendAsync("privatechatcreated", new { chatId = result.ChatId, exists = result.Exists });
                    
                    var chatData = new { 
                        chatId = result.ChatId, 
                        exists = result.Exists, 
                        createdBy = userId,
                        targetUserId = targetUserId
                    };

                    await Clients.User(userId.ToString()).SendAsync("chatcreated", userId, chatData);
                    
                    await Clients.User(targetUserId.ToString()).SendAsync("chatcreated", userId, chatData);
                }
                else
                {
                    await Clients.Caller.SendAsync("error", "Ошибка при создании чата: " + result.ErrorMessage);
                }
            }
            catch (Exception ex)
            {
                await Clients.Caller.SendAsync("error", "Произошла ошибка при создании чата: " + ex.Message);
            }
        }


        public async Task SearchUsers(string name)
        {
            try
            {
                var currentUserId = GetCurrentUserId();
                if (currentUserId == null)
                {
                    await Clients.Caller.SendAsync("Error", "Пользователь не авторизован");
                    return;
                }

                var query = new SearchUsersQuery(currentUserId.Value, name);
                var result = await _mediator.Send(query);
                await Clients.Caller.SendAsync("receivesearchresults", result.Users);
            }
            catch (Exception ex)
            {
                await Clients.Caller.SendAsync("error", "Произошла ошибка при поиске пользователей: " + ex.Message);
            }
        }

        public async Task CreateGroupChat(string chatName, List<Guid> userIds)
        {
            try
            {
                var currentUserId = GetCurrentUserId();
                if (currentUserId == null)
                {
                    await Clients.Caller.SendAsync("Error", "Пользователь не авторизован");
                    return;
                }

                if (string.IsNullOrEmpty(chatName) || userIds == null || !userIds.Any())
                {
                    await Clients.Caller.SendAsync("Error", "Неверные данные для создания группового чата.");
                    return;
                }

                var allUserIds = new List<Guid> { currentUserId.Value };
                allUserIds.AddRange(userIds);

                var command = new CreateGroupChatCommand(currentUserId.Value, chatName, allUserIds);
                var result = await _mediator.Send(command);

                if (result.Success)
                {
                    // Адресно каждому участнику (все его вкладки/устройства), а не Clients.All.
                    foreach (var userId in allUserIds)
                    {
                        await Clients.User(userId.ToString()).SendAsync("chatcreated", userId, new { chatId = result.ChatId });
                    }

                    await Clients.Caller.SendAsync("groupchatcreated", new
                    {
                        chatId = result.ChatId,
                        name = chatName,
                        members = allUserIds
                    });
                }
                else
                {
                    await Clients.Caller.SendAsync("error", "Ошибка при создании группового чата: " + result.ErrorMessage);
                }
            }
            catch (Exception ex)
            {
                await Clients.Caller.SendAsync("error", "Произошла ошибка при создании группового чата: " + ex.Message);
            }
        }

        public async Task PinChat(Guid chatId)
        {
            await SetChatPinInternal(chatId, isPinned: true);
        }

        public async Task UnpinChat(Guid chatId)
        {
            await SetChatPinInternal(chatId, isPinned: false);
        }

        public async Task ReorderPinnedChats(List<Guid> chatIds)
        {
            try
            {
                var userId = GetCurrentUserId();
                if (userId == null)
                {
                    await Clients.Caller.SendAsync("error", "Пользователь не авторизован");
                    return;
                }

                var command = new ReorderPinnedChatsCommand(userId.Value, chatIds ?? []);
                var result = await _mediator.Send(command);

                if (!result.Success)
                {
                    await Clients.Caller.SendAsync("error", result.ErrorMessage ?? "Не удалось изменить порядок закреплённых чатов");
                    return;
                }

                await BroadcastUserChatsAsync(userId.Value);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "ChatListHub: Error reordering pinned chats");
                await Clients.Caller.SendAsync("error", "Произошла ошибка при изменении порядка чатов: " + ex.Message);
            }
        }

        private async Task SetChatPinInternal(Guid chatId, bool isPinned)
        {
            try
            {
                var userId = GetCurrentUserId();
                if (userId == null)
                {
                    await Clients.Caller.SendAsync("error", "Пользователь не авторизован");
                    return;
                }

                var command = new SetChatPinCommand(userId.Value, chatId, isPinned);
                var result = await _mediator.Send(command);

                if (!result.Success)
                {
                    await Clients.Caller.SendAsync("error", result.ErrorMessage ?? "Не удалось изменить закрепление чата");
                    return;
                }

                await BroadcastUserChatsAsync(userId.Value);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "ChatListHub: Error setting chat pin for chat {ChatId}", chatId);
                await Clients.Caller.SendAsync("error", "Произошла ошибка при закреплении чата: " + ex.Message);
            }
        }

        private async Task BroadcastUserChatsAsync(Guid userId)
        {
            var query = new GetUserChatsQuery(userId);
            var chatsResult = await _mediator.Send(query);
            await Clients.User(userId.ToString()).SendAsync("receivechats", chatsResult.Chats);
        }
    }
}
