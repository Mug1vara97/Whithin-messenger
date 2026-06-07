using Microsoft.AspNetCore.SignalR;
using Microsoft.AspNetCore.Http;
using MediatR;
using WhithinMessenger.Application.CommandsAndQueries.Messages.SendMessage;
using WhithinMessenger.Application.CommandsAndQueries.Messages.GetMessages;
using WhithinMessenger.Application.CommandsAndQueries.Messages.GetMessageById;
using WhithinMessenger.Application.CommandsAndQueries.Messages.EditMessage;
using WhithinMessenger.Application.CommandsAndQueries.Messages.DeleteMessage;
using WhithinMessenger.Application.CommandsAndQueries.Messages.SearchMessages;
using WhithinMessenger.Application.CommandsAndQueries.Chats.GetChatParticipants;
using WhithinMessenger.Application.CommandsAndQueries.Chats.GetAvailableUsers;
using WhithinMessenger.Application.CommandsAndQueries.Chats.AddUserToGroup;
using WhithinMessenger.Application.CommandsAndQueries.Chats.GetChatInfo;
using WhithinMessenger.Application.CommandsAndQueries.Chats.DeletePrivateChat;
using WhithinMessenger.Application.CommandsAndQueries.User.GetUserProfile;
using WhithinMessenger.Application.Services;
using WhithinMessenger.Domain.Interfaces;
using WhithinMessenger.Api.Hubs;
using WhithinMessenger.Api.Services;
using System.Collections.Concurrent;
using System.Security.Claims;
using System.Linq;

namespace WhithinMessenger.Api.Hubs
{
public class GroupChatHub : Hub
{
    private static readonly ConcurrentDictionary<Guid, int> ActiveConnections = new();

    public static bool HasActiveConnection(Guid userId) =>
        ActiveConnections.TryGetValue(userId, out var count) && count > 0;
    private readonly IMediator _mediator;
    private readonly IHubContext<ChatListHub> _chatListHubContext;
    private readonly IHttpContextAccessor _httpContextAccessor;
    private readonly ILogger<GroupChatHub> _logger;
    private readonly INotificationService _notificationService;
    private readonly IChatRepository _chatRepository;
    private readonly IMessageRepository _messageRepository;
    private readonly IMessageReceiptService _messageReceiptService;

    public GroupChatHub(
        IMediator mediator,
        IHubContext<ChatListHub> chatListHubContext,
        IHttpContextAccessor httpContextAccessor,
        ILogger<GroupChatHub> logger,
        INotificationService notificationService,
        IChatRepository chatRepository,
        IMessageRepository messageRepository,
        IMessageReceiptService messageReceiptService)
    {
        _mediator = mediator;
        _chatListHubContext = chatListHubContext;
        _httpContextAccessor = httpContextAccessor;
        _logger = logger;
        _notificationService = notificationService;
        _chatRepository = chatRepository;
        _messageRepository = messageRepository;
        _messageReceiptService = messageReceiptService;
    }

        public async Task JoinGroup(string chatId)
        {
            if (Guid.TryParse(chatId, out Guid parsedChatId))
            {
                await Groups.AddToGroupAsync(Context.ConnectionId, parsedChatId.ToString());
            }
        }

        public async Task LeaveGroup(string chatId)
        {
            if (Guid.TryParse(chatId, out Guid parsedChatId))
            {
                await Groups.RemoveFromGroupAsync(Context.ConnectionId, parsedChatId.ToString());
            }
        }

        public Task GetMessages(string chatId) =>
            GetMessages(chatId, 0, null);

        public async Task GetMessages(string chatId, int limit, string? beforeMessageId)
        {
            try
            {
                _logger.LogInformation($"GetMessages called with chatId: {chatId}, limit: {limit}");
                
                if (!Guid.TryParse(chatId, out Guid parsedChatId))
                {
                    _logger.LogWarning($"Invalid chatId format: {chatId}");
                    await Clients.Caller.SendAsync("Error", $"Invalid chatId format: {chatId}");
                    return;
                }

                Guid? parsedBeforeMessageId = null;
                if (!string.IsNullOrWhiteSpace(beforeMessageId))
                {
                    if (!Guid.TryParse(beforeMessageId, out var beforeId))
                    {
                        await Clients.Caller.SendAsync("Error", $"Invalid beforeMessageId format: {beforeMessageId}");
                        return;
                    }

                    parsedBeforeMessageId = beforeId;
                }

                _logger.LogInformation($"Parsed chatId: {parsedChatId}");
                var userId = GetCurrentUserId();
                var query = new GetMessagesQuery(parsedChatId, userId, limit, parsedBeforeMessageId);
                var result = await _mediator.Send(query);

                if (result.Success)
                {
                    await Clients.Caller.SendAsync("ReceiveMessages", result.Messages);
                    if (limit > 0)
                    {
                        await Clients.Caller.SendAsync("ReceiveMessagesMeta", new
                        {
                            HasMoreOlder = result.HasMoreOlder,
                            Limit = limit,
                            BeforeMessageId = beforeMessageId,
                        });
                    }
                }
                else
                {
                    await Clients.Caller.SendAsync("Error", result.ErrorMessage);
                }
            }
            catch (Exception ex)
            {
                await Clients.Caller.SendAsync("Error", $"Ошибка при получении сообщений: {ex.Message}");
            }
        }

        public async Task SearchMessages(string chatId, string query)
        {
            try
            {
                _logger.LogInformation($"SearchMessages called with chatId: {chatId}, query: {query}");
                
                if (!Guid.TryParse(chatId, out Guid parsedChatId))
                {
                    _logger.LogWarning($"Invalid chatId format: {chatId}");
                    await Clients.Caller.SendAsync("Error", $"Invalid chatId format: {chatId}");
                    return;
                }

                if (string.IsNullOrWhiteSpace(query))
                {
                    await Clients.Caller.SendAsync("SearchMessagesResult", new List<object>());
                    return;
                }

                _logger.LogInformation($"Parsed chatId: {parsedChatId}");
                var searchQuery = new SearchMessagesQuery(parsedChatId, query);
                var result = await _mediator.Send(searchQuery);

                if (result.Success)
                {
                    await Clients.Caller.SendAsync("SearchMessagesResult", result.Messages);
                }
                else
                {
                    await Clients.Caller.SendAsync("Error", result.ErrorMessage);
                }
            }
            catch (Exception ex)
            {
                await Clients.Caller.SendAsync("Error", $"Ошибка при поиске сообщений: {ex.Message}");
            }
        }

        public async Task GetChatParticipants(string chatId)
        {
            try
            {
                _logger.LogInformation($"GetChatParticipants called with chatId: {chatId}");
                
                if (!Guid.TryParse(chatId, out Guid parsedChatId))
                {
                    _logger.LogWarning($"Invalid chatId format: {chatId}");
                    await Clients.Caller.SendAsync("Error", $"Invalid chatId format: {chatId}");
                    return;
                }

                var userId = GetCurrentUserId();
                if (userId == null)
                {
                    _logger.LogWarning("GetChatParticipants: User not authorized");
                    await Clients.Caller.SendAsync("Error", "Пользователь не авторизован");
                    return;
                }

                _logger.LogInformation($"GetChatParticipants: User authorized: {userId}");
                
                var query = new GetChatParticipantsQuery(parsedChatId, userId.Value);
                var result = await _mediator.Send(query);

                if (result.Success)
                {
                    _logger.LogInformation($"GetChatParticipants: Found {result.Participants.Count} participants");
                    await Clients.Caller.SendAsync("ReceiveChatParticipants", result.Participants);
                }
                else
                {
                    _logger.LogWarning($"GetChatParticipants: Failed to get participants: {result.ErrorMessage}");
                    await Clients.Caller.SendAsync("Error", result.ErrorMessage);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"GetChatParticipants: Exception occurred");
                await Clients.Caller.SendAsync("Error", $"Ошибка при получении участников чата: {ex.Message}");
            }
        }

        public async Task GetAvailableUsers(string chatId)
        {
            try
            {
                _logger.LogInformation($"GetAvailableUsers called with chatId: {chatId}");
                
                if (_mediator == null)
                {
                    _logger.LogError("GetAvailableUsers: Mediator is null");
                    await Clients.Caller.SendAsync("Error", "Mediator не инициализирован");
                    return;
                }
                
                if (!Guid.TryParse(chatId, out Guid parsedChatId))
                {
                    _logger.LogWarning($"Invalid chatId format: {chatId}");
                    await Clients.Caller.SendAsync("Error", $"Invalid chatId format: {chatId}");
                    return;
                }

                var userId = GetCurrentUserId();
                if (userId == null)
                {
                    _logger.LogWarning("GetAvailableUsers: User not authorized");
                    await Clients.Caller.SendAsync("Error", "Пользователь не авторизован");
                    return;
                }

                _logger.LogInformation($"GetAvailableUsers: User authorized: {userId}");
                
                var query = new GetAvailableUsersQuery(parsedChatId, userId.Value);
                var result = await _mediator.Send(query);

                if (result.Success)
                {
                    _logger.LogInformation($"GetAvailableUsers: Found {result.AvailableUsers.Count} available users");
                    await Clients.Caller.SendAsync("ReceiveAvailableUsers", result.AvailableUsers);
                }
                else
                {
                    _logger.LogWarning($"GetAvailableUsers: Failed to get available users: {result.ErrorMessage}");
                    await Clients.Caller.SendAsync("Error", result.ErrorMessage);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"GetAvailableUsers: Exception occurred");
                await Clients.Caller.SendAsync("Error", $"Ошибка при получении доступных пользователей: {ex.Message}");
            }
        }

        public async Task AddUserToGroup(string chatId, string targetUserId)
        {
            try
            {
                _logger.LogInformation($"AddUserToGroup called with chatId: {chatId}, targetUserId: {targetUserId}");
                
                if (_mediator == null)
                {
                    _logger.LogError("AddUserToGroup: Mediator is null");
                    await Clients.Caller.SendAsync("Error", "Mediator не инициализирован");
                    return;
                }
                
                if (!Guid.TryParse(chatId, out Guid parsedChatId))
                {
                    _logger.LogWarning($"Invalid chatId format: {chatId}");
                    await Clients.Caller.SendAsync("Error", $"Invalid chatId format: {chatId}");
                    return;
                }

                if (!Guid.TryParse(targetUserId, out Guid parsedTargetUserId))
                {
                    _logger.LogWarning($"Invalid targetUserId format: {targetUserId}");
                    await Clients.Caller.SendAsync("Error", $"Invalid targetUserId format: {targetUserId}");
                    return;
                }

                var userId = GetCurrentUserId();
                if (userId == null)
                {
                    _logger.LogWarning("AddUserToGroup: User not authorized");
                    await Clients.Caller.SendAsync("Error", "Пользователь не авторизован");
                    return;
                }

                _logger.LogInformation($"AddUserToGroup: User authorized: {userId}");
                
                var command = new AddUserToGroupCommand(parsedChatId, parsedTargetUserId, userId.Value);
                var result = await _mediator.Send(command);

                if (result.Success)
                {
                    _logger.LogInformation($"AddUserToGroup: User {parsedTargetUserId} added to group {parsedChatId}");
                    await Clients.Caller.SendAsync("UserAddedToGroup", parsedTargetUserId);
                    
                    await Clients.Group(chatId).SendAsync("GroupUpdated", "user_added", parsedTargetUserId);
                }
                else
                {
                    _logger.LogWarning($"AddUserToGroup: Failed to add user: {result.ErrorMessage}");
                    await Clients.Caller.SendAsync("Error", result.ErrorMessage);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"AddUserToGroup: Exception occurred");
                await Clients.Caller.SendAsync("Error", $"Ошибка при добавлении пользователя в группу: {ex.Message}");
            }
        }

        public async Task SendMessage(string message, string username, string chatId, Guid? repliedToMessageId = null, Guid? forwardedFromMessageId = null)
        {
            try
            {
                if (!Guid.TryParse(chatId, out Guid parsedChatId))
                {
                    await Clients.Caller.SendAsync("Error", $"Invalid chatId format: {chatId}");
                    return;
                }

                var userId = GetCurrentUserId();
                if (userId == null)
                {
                    await Clients.Caller.SendAsync("Error", "Пользователь не авторизован");
                    return;
                }

                var command = new SendMessageCommand(
                    userId.Value,
                    parsedChatId,
                    message,
                    repliedToMessageId,
                    forwardedFromMessageId
                );

                var result = await _mediator.Send(command);

                if (result.Success)
                {
                    object? repliedMessage = null;
                    if (repliedToMessageId.HasValue)
                    {
                        var repliedToMessage = await _mediator.Send(new GetMessageByIdQuery(repliedToMessageId.Value));
                        if (repliedToMessage.Success)
                        {
                            repliedMessage = new
                            {
                                messageId = repliedToMessage.Message.Id,
                                content = repliedToMessage.Message.Content,
                                senderUsername = repliedToMessage.Message.User?.UserName ?? "Unknown",
                                createdAt = repliedToMessage.Message.CreatedAt,
                                mediaFiles = repliedToMessage.Message.MediaFiles?.Select(mf => new
                                {
                                    id = mf.Id,
                                    fileName = mf.FileName,
                                    originalFileName = mf.OriginalFileName,
                                    filePath = mf.FilePath,
                                    contentType = mf.ContentType,
                                    fileSize = mf.FileSize,
                                    thumbnailPath = mf.ThumbnailPath,
                                    createdAt = mf.CreatedAt,
                                    isVideoNote = mf.IsVideoNote
                                }).ToList()
                            };
                        }
                    }

                    var messageQuery = new GetMessageByIdQuery(result.MessageId.Value);
                    var messageResult = await _mediator.Send(messageQuery);
                    
                    object? mediaFiles = null;
                    if (messageResult.Success && messageResult.Message != null)
                    {
                        mediaFiles = messageResult.Message.MediaFiles?.Select(mf => new
                        {
                            id = mf.Id,
                            fileName = mf.FileName,
                            originalFileName = mf.OriginalFileName,
                            filePath = mf.FilePath,
                            contentType = mf.ContentType,
                            fileSize = mf.FileSize,
                            thumbnailPath = mf.ThumbnailPath,
                            createdAt = mf.CreatedAt,
                            isVideoNote = mf.IsVideoNote
                        }).ToList();
                    }

                    var userProfile = await _mediator.Send(new GetUserProfileQuery(userId.Value));
                    string avatarColor = userProfile?.AvatarColor ?? GenerateAvatarColor(userId.Value);
                    string? avatarUrl = userProfile?.Avatar;

                    await Clients.Group(parsedChatId.ToString()).SendAsync("MessageSent", 
                        new { 
                            messageId = result.MessageId,
                            senderId = userId.Value,
                            content = message, 
                            username = username,
                            chatId = parsedChatId,
                            avatarUrl = avatarUrl,
                            avatarColor = avatarColor,
                            repliedMessage = repliedMessage,
                            forwardedMessage = (object?)null, // TODO: Implement forwarded message info
                            mediaFiles = mediaFiles,
                            status = MessageStatusHelper.Sent
                        });

                    // Отправляем ChatUpdated событие для обновления списка чатов
                    await _chatListHubContext.Clients.All.SendAsync("chatupdated", parsedChatId, message, DateTimeOffset.UtcNow);

                    await CreateNotificationsForChatMessage(
                        parsedChatId,
                        userId.Value,
                        username,
                        result.MessageId,
                        message
                    );

                    await _messageReceiptService.AutoDeliverToReachableRecipientsAsync(
                        parsedChatId,
                        result.MessageId.Value,
                        userId.Value);
                }
                else
                {
                    await Clients.Caller.SendAsync("Error", result.ErrorMessage);
                }
            }
            catch (Exception ex)
            {
                await Clients.Caller.SendAsync("Error", $"Ошибка при отправке сообщения: {ex.Message}");
            }
        }

        public async Task EditMessage(Guid messageId, string newContent, string username)
        {
            try
            {
                
                var userId = GetCurrentUserId();
                if (userId == null)
                {
                    await Clients.Caller.SendAsync("Error", "Пользователь не авторизован");
                    return;
                }

                var command = new EditMessageCommand(messageId, userId.Value, newContent);
                var result = await _mediator.Send(command);

                if (result.Success)
                {
                    
                    // Получаем chatId из сообщения для отправки в правильную группу
                    var messageQuery = new GetMessageByIdQuery(messageId);
                    var messageResult = await _mediator.Send(messageQuery);
                    
                    if (messageResult.Success && messageResult.Message != null)
                    {
                        await Clients.Group(messageResult.Message.ChatId.ToString()).SendAsync("MessageEdited", messageId, newContent);
                    }
                    else
                    {
                    }
                }
                else
                {
                    await Clients.Caller.SendAsync("Error", result.ErrorMessage);
                }
            }
            catch (Exception ex)
            {
                await Clients.Caller.SendAsync("Error", $"Ошибка при редактировании сообщения: {ex.Message}");
            }
        }

        public async Task DeleteMessage(Guid messageId, string username)
        {
            try
            {
                _logger.LogInformation($"DeleteMessage called with messageId: {messageId}, username: {username}");
                
                var userId = GetCurrentUserId();
                if (userId == null)
                {
                    _logger.LogWarning("DeleteMessage: User not authorized");
                    await Clients.Caller.SendAsync("Error", "Пользователь не авторизован");
                    return;
                }

                _logger.LogInformation($"DeleteMessage: User authorized: {userId}");
                
                // Получаем chatId из сообщения ПЕРЕД удалением
                var messageQuery = new GetMessageByIdQuery(messageId);
                var messageResult = await _mediator.Send(messageQuery);
                Guid? chatId = null;
                
                if (messageResult.Success && messageResult.Message != null)
                {
                    chatId = messageResult.Message.ChatId;
                    _logger.LogInformation($"DeleteMessage: Found chatId before deletion: {chatId}");
                }
                else
                {
                    _logger.LogWarning($"DeleteMessage: Failed to get message details before deletion");
                }

                var command = new DeleteMessageCommand(messageId, userId.Value);
                var result = await _mediator.Send(command);

                if (result.Success)
                {
                    if (chatId.HasValue)
                    {
                        _logger.LogInformation($"DeleteMessage: Sending MessageDeleted to group: {chatId}");
                        await Clients.Group(chatId.Value.ToString()).SendAsync("MessageDeleted", messageId);
                        _logger.LogInformation($"DeleteMessage: MessageDeleted sent successfully");
                    }
                    else
                    {
                        _logger.LogWarning($"DeleteMessage: No chatId available for sending MessageDeleted");
                    }
                }
                else
                {
                    _logger.LogWarning($"DeleteMessage: Failed to delete message: {result.ErrorMessage}");
                    await Clients.Caller.SendAsync("Error", result.ErrorMessage);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"DeleteMessage: Exception occurred");
                await Clients.Caller.SendAsync("Error", $"Ошибка при удалении сообщения: {ex.Message}");
            }
        }

        public async Task MarkMessageAsRead(Guid messageId, Guid chatId)
        {
            try
            {
                var userId = GetCurrentUserId();
                if (userId == null)
                {
                    await Clients.Caller.SendAsync("Error", "Пользователь не авторизован");
                    return;
                }

                var wasMarked = await _messageRepository.MarkMessageReadAsync(messageId, userId.Value);

                if (wasMarked)
                {
                    var readAt = DateTimeOffset.UtcNow;
                    await Clients.Group(chatId.ToString()).SendAsync("MessageRead", messageId, userId, readAt);
                }

                await _messageReceiptService.BroadcastMessageStatusAsync(chatId, messageId);
            }
            catch (Exception ex)
            {
                await Clients.Caller.SendAsync("Error", $"Ошибка при отметке сообщения как прочитанного: {ex.Message}");
            }
        }

        public async Task AcknowledgeDelivery(Guid messageId, Guid chatId)
        {
            try
            {
                var userId = GetCurrentUserId();
                if (userId == null)
                {
                    await Clients.Caller.SendAsync("Error", "Пользователь не авторизован");
                    return;
                }

                var wasMarked = await _messageRepository.MarkMessageDeliveredAsync(messageId, userId.Value);

                if (wasMarked)
                {
                    var deliveredAt = DateTimeOffset.UtcNow;
                    await Clients.Group(chatId.ToString()).SendAsync("MessageDelivered", messageId, userId, deliveredAt);
                }

                await _messageReceiptService.BroadcastMessageStatusAsync(chatId, messageId);
            }
            catch (Exception ex)
            {
                await Clients.Caller.SendAsync("Error", $"Ошибка при подтверждении доставки: {ex.Message}");
            }
        }

        public async Task AcknowledgePendingDeliveries()
        {
            try
            {
                var userId = GetCurrentUserId();
                if (userId == null)
                {
                    await Clients.Caller.SendAsync("Error", "Пользователь не авторизован");
                    return;
                }

                await _messageReceiptService.AcknowledgePendingDeliveriesForUserAsync(userId.Value);
            }
            catch (Exception ex)
            {
                await Clients.Caller.SendAsync("Error", $"Ошибка при подтверждении доставки: {ex.Message}");
            }
        }

        public async Task SendMediaMessage(string username, string mediaUrl, string chatId)
        {
            try
            {
                if (!Guid.TryParse(chatId, out Guid parsedChatId))
                {
                    await Clients.Caller.SendAsync("Error", $"Invalid chatId format: {chatId}");
                    return;
                }

                var userId = GetCurrentUserId();
                if (userId == null)
                {
                    await Clients.Caller.SendAsync("Error", "Пользователь не авторизован");
                    return;
                }

                var command = new SendMessageCommand(
                    userId.Value,
                    parsedChatId,
                    mediaUrl,
                    null,
                    null
                );

                var result = await _mediator.Send(command);

                if (result.Success)
                {
                    // Загружаем полную информацию о сообщении с медиафайлами
                    var messageQuery = new GetMessageByIdQuery(result.MessageId.Value);
                    var messageResult = await _mediator.Send(messageQuery);
                    
                    object? mediaFiles = null;
                    if (messageResult.Success && messageResult.Message != null)
                    {
                        mediaFiles = messageResult.Message.MediaFiles?.Select(mf => new
                        {
                            id = mf.Id,
                            fileName = mf.FileName,
                            originalFileName = mf.OriginalFileName,
                            filePath = mf.FilePath,
                            contentType = mf.ContentType,
                            fileSize = mf.FileSize,
                            thumbnailPath = mf.ThumbnailPath,
                            createdAt = mf.CreatedAt,
                            isVideoNote = mf.IsVideoNote
                        }).ToList();
                    }

                    // Получаем данные профиля пользователя
                    var userProfile = await _mediator.Send(new GetUserProfileQuery(userId.Value));
                    string avatarColor = userProfile?.AvatarColor ?? GenerateAvatarColor(userId.Value);
                    string? avatarUrl = userProfile?.Avatar;

                    // Уведомляем всех участников чата о новом медиафайле
                    await Clients.Group(parsedChatId.ToString()).SendAsync("MessageSent", 
                        new { 
                            messageId = result.MessageId,
                            senderId = userId.Value,
                            content = mediaUrl, 
                            username = username,
                            chatId = parsedChatId,
                            avatarUrl = avatarUrl,
                            avatarColor = avatarColor,
                            repliedMessage = (object?)null,
                            forwardedMessage = (object?)null,
                            mediaFiles = mediaFiles,
                            status = MessageStatusHelper.Sent
                        });

                    // Отправляем ChatUpdated событие для обновления списка чатов
                    await _chatListHubContext.Clients.All.SendAsync("chatupdated", parsedChatId, mediaUrl, DateTimeOffset.UtcNow);

                    await CreateNotificationsForChatMessage(
                        parsedChatId,
                        userId.Value,
                        username,
                        result.MessageId,
                        "Отправил медиафайл"
                    );

                    await _messageReceiptService.AutoDeliverToReachableRecipientsAsync(
                        parsedChatId,
                        result.MessageId.Value,
                        userId.Value);
                }
                else
                {
                    await Clients.Caller.SendAsync("Error", result.ErrorMessage);
                }
            }
            catch (Exception ex)
            {
                await Clients.Caller.SendAsync("Error", $"Ошибка при отправке медиафайла: {ex.Message}");
            }
        }

        // Методы для звонков - только уведомления в реальном времени
        public async Task NotifyCallStarted(Guid chatId, Guid callerId)
        {
            try
            {
                await Clients.Group(chatId.ToString()).SendAsync("CallStarted", chatId, callerId);
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine($"Error notifying call started: {ex.Message}");
            }
        }

        public async Task NotifyCallEnded(Guid chatId)
        {
            try
            {
                await Clients.Group(chatId.ToString()).SendAsync("CallEnded", chatId);
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine($"Error notifying call ended: {ex.Message}");
            }
        }

        public async Task NotifyTyping(string chatId, string username)
        {
            try
            {
                if (!Guid.TryParse(chatId, out Guid parsedChatId))
                {
                    return;
                }

                var userId = GetCurrentUserId();
                if (userId == null)
                {
                    return;
                }

                var displayName = string.IsNullOrWhiteSpace(username) ? "Пользователь" : username.Trim();
                await Clients.OthersInGroup(parsedChatId.ToString()).SendAsync(
                    "UserTyping",
                    parsedChatId.ToString(),
                    userId.Value.ToString(),
                    displayName);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Error notifying typing for chat {ChatId}", chatId);
            }
        }

        public async Task NotifyStopTyping(string chatId)
        {
            try
            {
                if (!Guid.TryParse(chatId, out Guid parsedChatId))
                {
                    return;
                }

                var userId = GetCurrentUserId();
                if (userId == null)
                {
                    return;
                }

                await Clients.OthersInGroup(parsedChatId.ToString()).SendAsync(
                    "UserStoppedTyping",
                    parsedChatId.ToString(),
                    userId.Value.ToString());
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Error notifying stop typing for chat {ChatId}", chatId);
            }
        }

    public async Task SendCallNotification(Guid chatId, string caller, Guid callerId)
    {
        try
        {
            await Clients.Group(chatId.ToString()).SendAsync("IncomingCall",
                new { chatId, caller, callerId, roomId = chatId.ToString() });

            // Also push to mobile devices so Android can show incoming call
            // even when the app process is not active.
            var participantIds = await _chatRepository.GetChatMembersAsync(chatId);
            foreach (var participantId in participantIds.Where(id => id != callerId))
            {
                try
                {
                    await _notificationService.SendIncomingCallPushAsync(
                        userId: participantId,
                        chatId: chatId,
                        callerId: callerId,
                        callerName: caller
                    );
                }
                catch (Exception pushEx)
                {
                    _logger.LogWarning(pushEx, "Failed to send incoming-call push for chat {ChatId} to user {UserId}", chatId, participantId);
                }
            }
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine($"Error sending call notification: {ex.Message}");
        }
    }

        // Вспомогательный метод для получения текущего пользователя
        private Guid? GetCurrentUserId()
        {
            try
            {
                // Сначала пробуем получить из JWT claims
                if (Context.User?.Identity?.IsAuthenticated == true)
                {
                    var userIdClaim = Context.User.FindFirst("UserId")?.Value;
                    if (Guid.TryParse(userIdClaim, out var userId))
                    {
                        _logger.LogInformation($"GetCurrentUserId: Found UserId from JWT: {userId}");
                        return userId;
                    }
                }
                
                // Fallback на query parameter (для совместимости)
                var httpContextFromSignalR = Context.GetHttpContext();
                if (httpContextFromSignalR != null)
                {
                    var userIdString = httpContextFromSignalR.Request.Query["userId"].ToString();
                    if (!string.IsNullOrEmpty(userIdString) && Guid.TryParse(userIdString, out Guid userId))
                    {
                        _logger.LogInformation($"GetCurrentUserId: Found userId from query: {userId}");
                        return userId;
                    }
                }
                
                _logger.LogWarning($"GetCurrentUserId: No UserId found in JWT claims or query");
                return null;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"GetCurrentUserId: Exception occurred");
                return null;
            }
        }

        public override async Task OnConnectedAsync()
        {
            var userId = GetCurrentUserId();
            if (userId.HasValue)
            {
                ActiveConnections.AddOrUpdate(userId.Value, 1, (_, current) => current + 1);
                await Groups.AddToGroupAsync(Context.ConnectionId, $"user-{userId}");

                try
                {
                    await _messageReceiptService.AcknowledgePendingDeliveriesForUserAsync(userId.Value);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Failed to acknowledge pending deliveries for user {UserId}", userId);
                }
            }
            await base.OnConnectedAsync();
        }

        public override async Task OnDisconnectedAsync(Exception? exception)
        {
            var userId = GetCurrentUserId();
            if (userId.HasValue)
            {
                DecrementConnectionCount(userId.Value);
                await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"user-{userId}");
            }
            await base.OnDisconnectedAsync(exception);
        }

        private static void DecrementConnectionCount(Guid userId)
        {
            if (!ActiveConnections.TryGetValue(userId, out var current))
            {
                return;
            }

            if (current <= 1)
            {
                ActiveConnections.TryRemove(userId, out _);
                return;
            }

            ActiveConnections.TryUpdate(userId, current - 1, current);
        }

        public async Task GetChatInfo(Guid chatId)
        {
            try
            {
                var userId = GetCurrentUserId();
                if (userId == null)
                {
                    await Clients.Caller.SendAsync("Error", "Пользователь не авторизован");
                    return;
                }

                var chatInfo = await _mediator.Send(new GetChatInfoQuery(chatId, userId.Value));
                
                if (chatInfo.Success && chatInfo.ChatInfo != null)
                {
                    await Clients.Caller.SendAsync("ChatInfoReceived", chatInfo.ChatInfo);
                }
                else
                {
                    await Clients.Caller.SendAsync("Error", chatInfo.ErrorMessage ?? "Не удалось получить информацию о чате");
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"GroupChatHub - Error getting chat info: {ex.Message}");
                await Clients.Caller.SendAsync("Error", "Ошибка при получении информации о чате");
            }
        }

        private static string GenerateAvatarColor(Guid userId) 
        {
            string[] colors = { "#5865F2", "#EB459E", "#ED4245", "#FEE75C", "#57F287", "#FAA61A" };
            int index = Math.Abs(userId.GetHashCode()) % colors.Length;
            return colors[index];
        }

        private async Task CreateNotificationsForChatMessage(
            Guid chatId,
            Guid senderId,
            string senderUsername,
            Guid? messageId,
            string previewText
        )
        {
            try
            {
                var chat = await _chatRepository.GetByIdAsync(chatId);
                if (chat == null) return;

                var chatMembers = await _chatRepository.GetChatMembersAsync(chatId);
                var notificationMembers = chatMembers.Where(m => m != senderId).ToList();
                if (!notificationMembers.Any()) return;

                var isGroupChat = chat.Type?.TypeName == "Group";
                var notificationType = isGroupChat ? "group_message" : "direct_message";
                var chatName = string.IsNullOrWhiteSpace(chat.Name) ? senderUsername : chat.Name;
                var cleanPreview = string.IsNullOrWhiteSpace(previewText) ? "Новое сообщение" : previewText;
                var truncatedPreview = cleanPreview.Length > 140 ? cleanPreview[..140] : cleanPreview;
                var notificationContent = isGroupChat
                    ? $"{senderUsername} в {chatName}: {truncatedPreview}"
                    : $"{senderUsername}: {truncatedPreview}";

                foreach (var memberId in notificationMembers)
                {
                    var pushChatTitle = chatName;
                    if (!isGroupChat && chat.Type?.TypeName == "Private")
                    {
                        pushChatTitle = senderUsername;
                    }

                    await _notificationService.CreateNotificationAsync(
                        memberId,
                        chatId,
                        messageId,
                        notificationType,
                        notificationContent,
                        chat.ServerId,
                        pushChatTitle
                    );

                    var unreadCount = await _messageRepository.GetUnreadCountByChatAsync(chatId, memberId);
                    await _chatListHubContext.Clients.Group($"user-{memberId}")
                        .SendAsync("chatunreadupdated", chatId, unreadCount);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating notifications for chat message");
            }
        }

        public async Task DeleteChat(Guid chatId)
        {
            try
            {
                var userId = GetCurrentUserId();
                if (userId == null)
                {
                    await Clients.Caller.SendAsync("Error", "Пользователь не авторизован");
                    return;
                }

                var command = new DeletePrivateChatCommand(chatId, userId.Value);
                var result = await _mediator.Send(command);

                if (result.Success)
                {
                    await Clients.Group(chatId.ToString()).SendAsync("chatdeleted", new
                    {
                        chatId = chatId,
                        deletedBy = userId.Value
                    });

                    await _chatListHubContext.Clients.All.SendAsync("chatdeleted", new
                    {
                        chatId = chatId,
                        deletedBy = userId.Value
                    });
                }
                else
                {
                    await Clients.Caller.SendAsync("Error", result.ErrorMessage);
                }
            }
            catch (Exception ex)
            {
                await Clients.Caller.SendAsync("Error", $"Ошибка при удалении чата: {ex.Message}");
            }
        }
    }
}




