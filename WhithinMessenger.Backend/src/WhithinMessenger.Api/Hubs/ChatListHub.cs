using Microsoft.AspNetCore.SignalR;
using Microsoft.AspNetCore.Http;
using System.Text;
using System.Text.Json;
using MediatR;
using WhithinMessenger.Application.CommandsAndQueries.Chats.GetUserChats;
using WhithinMessenger.Application.CommandsAndQueries.Chats.CreatePrivateChat;
using WhithinMessenger.Application.CommandsAndQueries.Chats.CreateGroupChat;
using WhithinMessenger.Application.CommandsAndQueries.Users.SearchUsers;
using Microsoft.Extensions.Logging;
using System.Security.Claims;

namespace WhithinMessenger.Api.Hubs
{
    public class ChatListHub : Hub
    {
        private readonly IMediator _mediator;
        private readonly IHttpContextAccessor _httpContextAccessor;
        private readonly ILogger<ChatListHub> _logger;

        public ChatListHub(IMediator mediator, IHttpContextAccessor httpContextAccessor, ILogger<ChatListHub> logger)
        {
            _mediator = mediator;
            _httpContextAccessor = httpContextAccessor;
            _logger = logger;
        }

        public async Task JoinChatGroup(int chatId)
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, $"chat-{chatId}");
        }


        public async Task LeaveChatGroup(int chatId)
        {
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"chat-{chatId}");
        }

        public async Task GetUserChats()
        {
            try
            {
                _logger.LogInformation("ChatListHub: GetUserChats called");
                var userId = GetCurrentUserId();
                _logger.LogInformation($"ChatListHub: GetCurrentUserId returned: {userId}");
                
                if (userId == null)
                {
                    _logger.LogWarning("ChatListHub: User not authorized");
                    await Clients.Caller.SendAsync("Error", "Пользователь не авторизован");
                    return;
                }

                _logger.LogInformation($"ChatListHub: Getting chats for user: {userId}");
                var query = new GetUserChatsQuery(userId.Value);
                var result = await _mediator.Send(query);
                _logger.LogInformation($"ChatListHub: Found {result.Chats.Count} chats");
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

                    Console.WriteLine($"Sending ChatCreated to participants (createdBy: {userId}, targetUserId: {targetUserId})");
                    
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
                    foreach (var userId in allUserIds)
                    {
                        await Clients.All.SendAsync("chatcreated", userId, new { chatId = result.ChatId });
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


        private Guid? GetCurrentUserId()
        {
            _logger.LogInformation($"ChatListHub: GetCurrentUserId called");
            _logger.LogInformation($"ChatListHub: Context.User is null: {Context.User == null}");
            _logger.LogInformation($"ChatListHub: Context.User.Identity.IsAuthenticated: {Context.User?.Identity?.IsAuthenticated}");
            
            // Сначала пробуем получить из JWT claims
            var userIdClaim = Context.User?.FindFirst("UserId")?.Value;
            _logger.LogInformation($"ChatListHub: JWT UserId claim: {userIdClaim}");
            
            if (Guid.TryParse(userIdClaim, out var userId))
            {
                _logger.LogInformation($"ChatListHub: Found UserId from JWT: {userId}");
                return userId;
            }

            // Fallback на query parameter (для совместимости)
            var userIdFromQuery = Context.GetHttpContext()?.Request.Query["userId"].FirstOrDefault();
            _logger.LogInformation($"ChatListHub: Query UserId: {userIdFromQuery}");
            
            if (Guid.TryParse(userIdFromQuery, out var userIdFromQueryParsed))
            {
                _logger.LogInformation($"ChatListHub: Found UserId from query: {userIdFromQueryParsed}");
                return userIdFromQueryParsed;
            }

            _logger.LogWarning("ChatListHub: No UserId found");
            return null;
        }

        public override async Task OnConnectedAsync()
        {
            var userId = GetCurrentUserId();
            if (userId.HasValue)
            {
                await Groups.AddToGroupAsync(Context.ConnectionId, $"user-{userId}");
            }
            await base.OnConnectedAsync();
        }

        public override async Task OnDisconnectedAsync(Exception? exception)
        {
            var userId = GetCurrentUserId();
            if (userId.HasValue)
            {
                await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"user-{userId}");
            }
            await base.OnDisconnectedAsync(exception);
        }
    }
}
