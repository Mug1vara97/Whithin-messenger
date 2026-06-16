using Microsoft.AspNetCore.SignalR;
using Microsoft.AspNetCore.Http;
using MediatR;
using WhithinMessenger.Application.CommandsAndQueries.Messages.SendMessage;
using WhithinMessenger.Application.CommandsAndQueries.Messages.GetMessages;
using WhithinMessenger.Application.CommandsAndQueries.Messages.GetMessageById;
using WhithinMessenger.Application.CommandsAndQueries.Messages.EditMessage;
using WhithinMessenger.Application.CommandsAndQueries.Messages.DeleteMessage;
using WhithinMessenger.Application.CommandsAndQueries.Messages.PinMessage;
using WhithinMessenger.Application.CommandsAndQueries.Messages.UnpinMessage;
using WhithinMessenger.Application.CommandsAndQueries.Messages.CreatePoll;
using WhithinMessenger.Application.CommandsAndQueries.Messages.VotePoll;
using WhithinMessenger.Application.CommandsAndQueries.Messages.GetPinnedMessages;
using WhithinMessenger.Application.CommandsAndQueries.Messages.SearchMessages;
using WhithinMessenger.Application.CommandsAndQueries.Chats.GetChatParticipants;
using WhithinMessenger.Application.CommandsAndQueries.Chats.GetAvailableUsers;
using WhithinMessenger.Application.CommandsAndQueries.Chats.AddUserToGroup;
using WhithinMessenger.Application.CommandsAndQueries.Chats.DeleteGroupChat;
using WhithinMessenger.Application.CommandsAndQueries.Chats.LeaveGroupChat;
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
using System.Text.Json;
using WhithinMessenger.Domain.Models;

namespace WhithinMessenger.Api.Hubs
{
public class GroupChatHub : Hub
{
    private const int CallRingTimeoutSeconds = 180;

    private sealed class CallSession
    {
        public Guid ChatId { get; init; }
        public Guid CallerId { get; init; }
        public string CallerName { get; set; } = string.Empty;
        public DateTimeOffset RingStartedAt { get; init; }
        public DateTimeOffset? AnsweredAt { get; set; }
        public bool IsAnswered => AnsweredAt.HasValue;
    }

    private static readonly ConcurrentDictionary<Guid, CallSession> CallSessions = new();
    private static readonly ConcurrentDictionary<Guid, CancellationTokenSource> CallRingTimeouts = new();

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
    private readonly ChatMessageNotificationService _chatMessageNotificationService;
    private readonly IMessageReceiptService _messageReceiptService;
    private readonly IUserRepository _userRepository;

    public GroupChatHub(
        IMediator mediator,
        IHubContext<ChatListHub> chatListHubContext,
        IHttpContextAccessor httpContextAccessor,
        ILogger<GroupChatHub> logger,
        INotificationService notificationService,
        IChatRepository chatRepository,
        IMessageRepository messageRepository,
        ChatMessageNotificationService chatMessageNotificationService,
        IMessageReceiptService messageReceiptService,
        IUserRepository userRepository)
    {
        _mediator = mediator;
        _chatListHubContext = chatListHubContext;
        _httpContextAccessor = httpContextAccessor;
        _logger = logger;
        _notificationService = notificationService;
        _chatRepository = chatRepository;
        _messageRepository = messageRepository;
        _chatMessageNotificationService = chatMessageNotificationService;
        _messageReceiptService = messageReceiptService;
        _userRepository = userRepository;
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
                            forwardedMessage = messageResult.Success
                                ? BuildForwardedMessagePayload(messageResult.Message)
                                : null,
                            mediaFiles = mediaFiles,
                            status = MessageStatusHelper.Sent
                        });

                    await _chatMessageNotificationService.NotifyTextMessageAsync(
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

        public async Task PinMessage(Guid messageId)
        {
            try
            {
                var userId = GetCurrentUserId();
                if (userId == null)
                {
                    await Clients.Caller.SendAsync("Error", "Пользователь не авторизован");
                    return;
                }

                var result = await _mediator.Send(new PinMessageCommand(messageId, userId.Value));
                if (!result.Success || !result.ChatId.HasValue)
                {
                    await Clients.Caller.SendAsync("Error", result.ErrorMessage ?? "Не удалось закрепить сообщение");
                    return;
                }

                await Clients.Group(result.ChatId.Value.ToString()).SendAsync(
                    "MessagePinned",
                    new
                    {
                        messageId,
                        chatId = result.ChatId.Value,
                        pinnedAt = result.PinnedAt,
                    });
            }
            catch (Exception ex)
            {
                await Clients.Caller.SendAsync("Error", $"Ошибка при закреплении сообщения: {ex.Message}");
            }
        }

        public async Task UnpinMessage(Guid messageId)
        {
            try
            {
                var userId = GetCurrentUserId();
                if (userId == null)
                {
                    await Clients.Caller.SendAsync("Error", "Пользователь не авторизован");
                    return;
                }

                var result = await _mediator.Send(new UnpinMessageCommand(messageId, userId.Value));
                if (!result.Success || !result.ChatId.HasValue)
                {
                    await Clients.Caller.SendAsync("Error", result.ErrorMessage ?? "Не удалось открепить сообщение");
                    return;
                }

                await Clients.Group(result.ChatId.Value.ToString()).SendAsync(
                    "MessageUnpinned",
                    new
                    {
                        messageId,
                        chatId = result.ChatId.Value,
                    });
            }
            catch (Exception ex)
            {
                await Clients.Caller.SendAsync("Error", $"Ошибка при откреплении сообщения: {ex.Message}");
            }
        }

        public async Task GetPinnedMessages(string chatId)
        {
            try
            {
                if (!Guid.TryParse(chatId, out var parsedChatId))
                {
                    await Clients.Caller.SendAsync("Error", $"Invalid chatId format: {chatId}");
                    return;
                }

                var userId = GetCurrentUserId();
                var result = await _mediator.Send(new GetPinnedMessagesQuery(parsedChatId, userId));
                if (!result.Success)
                {
                    await Clients.Caller.SendAsync("Error", result.ErrorMessage);
                    return;
                }

                await Clients.Caller.SendAsync("ReceivePinnedMessages", result.Messages);
            }
            catch (Exception ex)
            {
                await Clients.Caller.SendAsync("Error", $"Ошибка при загрузке закреплённых сообщений: {ex.Message}");
            }
        }

        public async Task CreatePoll(string chatId, string question, string[] options, bool allowMultiple, bool isAnonymous = true)
        {
            try
            {
                if (!Guid.TryParse(chatId, out var parsedChatId))
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

                var result = await _mediator.Send(new CreatePollCommand(
                    userId.Value,
                    parsedChatId,
                    question,
                    options ?? Array.Empty<string>(),
                    allowMultiple,
                    isAnonymous));

                if (!result.Success || !result.MessageId.HasValue)
                {
                    await Clients.Caller.SendAsync("Error", result.ErrorMessage ?? "Не удалось создать опрос");
                    return;
                }

                var messageResult = await _mediator.Send(new GetMessageByIdQuery(result.MessageId.Value));
                if (!messageResult.Success || messageResult.Message == null)
                {
                    await Clients.Caller.SendAsync("Error", "Опрос создан, но не удалось загрузить сообщение");
                    return;
                }

                var userProfile = await _mediator.Send(new GetUserProfileQuery(userId.Value));
                var message = messageResult.Message;
                var username = message.User?.UserName ?? "Unknown";

                await Clients.Group(parsedChatId.ToString()).SendAsync("MessageSent", new
                {
                    messageId = message.Id,
                    senderId = userId.Value,
                    content = message.Content,
                    username,
                    chatId = parsedChatId,
                    contentType = message.ContentType,
                    avatarUrl = userProfile?.Avatar,
                    avatarColor = userProfile?.AvatarColor ?? GenerateAvatarColor(userId.Value),
                    poll = BuildPollPayload(message.Poll, userId.Value),
                    isPinned = false,
                    status = MessageStatusHelper.Sent,
                });

                await _messageReceiptService.AutoDeliverToReachableRecipientsAsync(
                    parsedChatId,
                    message.Id,
                    userId.Value);
            }
            catch (Exception ex)
            {
                await Clients.Caller.SendAsync("Error", $"Ошибка при создании опроса: {ex.Message}");
            }
        }

        public async Task VotePoll(Guid messageId, Guid[] optionIds)
        {
            try
            {
                var userId = GetCurrentUserId();
                if (userId == null)
                {
                    await Clients.Caller.SendAsync("Error", "Пользователь не авторизован");
                    return;
                }

                var result = await _mediator.Send(new VotePollCommand(
                    userId.Value,
                    messageId,
                    optionIds ?? Array.Empty<Guid>()));

                if (!result.Success || !result.ChatId.HasValue || !result.MessageId.HasValue)
                {
                    await Clients.Caller.SendAsync("Error", result.ErrorMessage ?? "Не удалось проголосовать");
                    return;
                }

                var messageResult = await _mediator.Send(new GetMessageByIdQuery(result.MessageId.Value));
                if (!messageResult.Success || messageResult.Message?.Poll == null)
                {
                    return;
                }

                await Clients.Group(result.ChatId.Value.ToString()).SendAsync(
                    "PollUpdated",
                    new
                    {
                        messageId = result.MessageId.Value,
                        chatId = result.ChatId.Value,
                        poll = BuildPollPayload(messageResult.Message.Poll, null),
                        viewerUserId = userId.Value,
                        viewerVotedOptionIds = PollDtoMapper.Map(messageResult.Message.Poll, userId.Value)?.VotedOptionIds ?? new List<Guid>(),
                    });
            }
            catch (Exception ex)
            {
                await Clients.Caller.SendAsync("Error", $"Ошибка при голосовании: {ex.Message}");
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
                            forwardedMessage = messageResult.Success
                                ? BuildForwardedMessagePayload(messageResult.Message)
                                : null,
                            mediaFiles = mediaFiles,
                            status = MessageStatusHelper.Sent
                        });

                    var firstMedia = messageResult.Success
                        ? messageResult.Message?.MediaFiles?.FirstOrDefault()
                        : null;

                    await _chatMessageNotificationService.NotifyMediaMessageAsync(
                        parsedChatId,
                        userId.Value,
                        username,
                        result.MessageId,
                        caption: messageResult.Message?.Content,
                        mediaContentType: firstMedia?.ContentType ?? "application/octet-stream",
                        isVideoNote: firstMedia?.IsVideoNote ?? false,
                        thumbnailPath: firstMedia?.ThumbnailPath,
                        filePath: firstMedia?.FilePath
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
            var callerUser = await _userRepository.GetByIdAsync(callerId);
            var resolvedCallerName = callerUser?.UserName?.Trim();
            if (string.IsNullOrWhiteSpace(resolvedCallerName))
            {
                resolvedCallerName = caller?.Trim();
            }
            if (string.IsNullOrWhiteSpace(resolvedCallerName))
            {
                resolvedCallerName = "Пользователь";
            }

            CallSessions[chatId] = new CallSession
            {
                ChatId = chatId,
                CallerId = callerId,
                CallerName = resolvedCallerName,
                RingStartedAt = DateTimeOffset.UtcNow,
            };
            ScheduleCallRingTimeout(chatId);

            await Clients.Group(chatId.ToString()).SendAsync("IncomingCall",
                new { chatId, caller = resolvedCallerName, callerId, roomId = chatId.ToString() });

            var callerProfile = await _mediator.Send(new GetUserProfileQuery(callerId));
            var callerAvatar = callerProfile?.Avatar;
            var callerAvatarColor = callerProfile?.AvatarColor;

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
                        callerName: resolvedCallerName,
                        callerAvatar: callerAvatar,
                        callerAvatarColor: callerAvatarColor
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

    public async Task AcceptCall(Guid chatId)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (userId == null)
            {
                return;
            }

            if (!CallSessions.TryGetValue(chatId, out var session))
            {
                return;
            }

            if (session.CallerId == userId.Value)
            {
                return;
            }

            session.AnsweredAt = DateTimeOffset.UtcNow;
            CancelCallRingTimeout(chatId);

            await Clients.Group(chatId.ToString()).SendAsync("CallAccepted", new
            {
                chatId,
                callerId = session.CallerId,
                calleeId = userId.Value,
            });

            await NotifyIncomingCallDismissedAsync(userId.Value, chatId, "accepted", userId.Value);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "AcceptCall failed for chat {ChatId}", chatId);
        }
    }

    public async Task DeclineCall(Guid chatId)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (userId == null)
            {
                return;
            }

            await FinalizeMissedCallAsync(chatId, userId.Value, "declined");
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "DeclineCall failed for chat {ChatId}", chatId);
        }
    }

    public async Task CancelOutgoingCall(Guid chatId)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (userId == null)
            {
                return;
            }

            if (!CallSessions.TryGetValue(chatId, out var session) || session.CallerId != userId.Value || session.IsAnswered)
            {
                return;
            }

            var participantIds = await _chatRepository.GetChatMembersAsync(chatId);
            ClearCallSession(chatId);
            await Clients.Group(chatId.ToString()).SendAsync("CallCancelled", new { chatId, callerId = session.CallerId });

            foreach (var participantId in participantIds.Where(id => id != session.CallerId))
            {
                await NotifyIncomingCallDismissedAsync(participantId, chatId, "cancelled", userId.Value);
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "CancelOutgoingCall failed for chat {ChatId}", chatId);
        }
    }

    public async Task ReportMissedCall(Guid chatId)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (userId == null)
            {
                return;
            }

            await FinalizeMissedCallAsync(chatId, userId.Value, "timeout");
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "ReportMissedCall failed for chat {ChatId}", chatId);
        }
    }

    public async Task EndCall(Guid chatId, int durationSeconds)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (userId == null)
            {
                return;
            }

            if (!CallSessions.TryRemove(chatId, out var session))
            {
                return;
            }

            CancelCallRingTimeout(chatId);

            if (!session.IsAnswered)
            {
                return;
            }

            var safeDuration = Math.Max(0, durationSeconds);
            await BroadcastCallLogMessageAsync(session, "completed", safeDuration);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "EndCall failed for chat {ChatId}", chatId);
        }
    }

    private void ScheduleCallRingTimeout(Guid chatId)
    {
        CancelCallRingTimeout(chatId);
        var cts = new CancellationTokenSource();
        CallRingTimeouts[chatId] = cts;

        _ = Task.Run(async () =>
        {
            try
            {
                await Task.Delay(TimeSpan.FromSeconds(CallRingTimeoutSeconds), cts.Token);
                if (!CallSessions.TryGetValue(chatId, out var session) || session.IsAnswered)
                {
                    return;
                }

                await FinalizeMissedCallAsync(chatId, session.CallerId, "timeout");
            }
            catch (OperationCanceledException)
            {
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Call ring timeout failed for chat {ChatId}", chatId);
            }
        });
    }

    private static void CancelCallRingTimeout(Guid chatId)
    {
        if (CallRingTimeouts.TryRemove(chatId, out var cts))
        {
            cts.Cancel();
            cts.Dispose();
        }
    }

    private static void ClearCallSession(Guid chatId)
    {
        CallSessions.TryRemove(chatId, out _);
        CancelCallRingTimeout(chatId);
    }

    private async Task FinalizeMissedCallAsync(Guid chatId, Guid actorUserId, string reason)
    {
        if (!CallSessions.TryRemove(chatId, out var session) || session.IsAnswered)
        {
            return;
        }

        CancelCallRingTimeout(chatId);

        var ringDuration = Math.Max(1, (int)Math.Round((DateTimeOffset.UtcNow - session.RingStartedAt).TotalSeconds));
        await BroadcastCallLogMessageAsync(session, "missed", ringDuration);

        await Clients.Group(chatId.ToString()).SendAsync("CallMissed", new
        {
            chatId,
            callerId = session.CallerId,
            reason,
            actorUserId,
        });

        var participantIds = await _chatRepository.GetChatMembersAsync(chatId);
        var dismissReason = reason switch
        {
            "declined" => "declined",
            "timeout" => "missed",
            _ => "missed",
        };
        foreach (var participantId in participantIds.Where(id => id != session.CallerId))
        {
            await NotifyIncomingCallDismissedAsync(participantId, chatId, dismissReason, actorUserId);
        }
    }

    private async Task NotifyIncomingCallDismissedAsync(
        Guid userId,
        Guid chatId,
        string reason,
        Guid? actorUserId = null)
    {
        await Clients.User(userId.ToString()).SendAsync("IncomingCallDismissed", new
        {
            chatId,
            reason,
            actorUserId,
        });
    }

    private async Task BroadcastCallLogMessageAsync(CallSession session, string callEvent, int durationSeconds)
    {
        var payload = JsonSerializer.Serialize(new
        {
            callEvent,
            callerId = session.CallerId,
            callerName = session.CallerName,
            durationSeconds,
        });

        var message = new Message
        {
            Id = Guid.NewGuid(),
            ChatId = session.ChatId,
            UserId = session.CallerId,
            Content = payload,
            ContentType = "call_log",
            CreatedAt = DateTimeOffset.UtcNow,
        };

        await _messageRepository.AddAsync(message);

        var userProfile = await _mediator.Send(new GetUserProfileQuery(session.CallerId));

        await Clients.Group(session.ChatId.ToString()).SendAsync("MessageSent", new
        {
            messageId = message.Id,
            senderId = session.CallerId,
            content = payload,
            username = session.CallerName,
            chatId = session.ChatId,
            contentType = "call_log",
            createdAt = message.CreatedAt,
            avatarUrl = userProfile?.Avatar,
            avatarColor = userProfile?.AvatarColor ?? GenerateAvatarColor(session.CallerId),
            status = MessageStatusHelper.Sent,
        });

        await _messageReceiptService.AutoDeliverToReachableRecipientsAsync(
            session.ChatId,
            message.Id,
            session.CallerId);
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

        public async Task LeaveGroupChat(Guid chatId)
        {
            try
            {
                var userId = GetCurrentUserId();
                if (userId == null)
                {
                    await Clients.Caller.SendAsync("Error", "Пользователь не авторизован");
                    return;
                }

                var result = await _mediator.Send(new LeaveGroupChatCommand(chatId, userId.Value));
                if (!result.Success)
                {
                    await Clients.Caller.SendAsync("Error", result.ErrorMessage);
                    return;
                }

                await Clients.Caller.SendAsync("LeftGroupChat", chatId);
                await Clients.Caller.SendAsync("chatdeleted", new
                {
                    chatId = chatId,
                    deletedBy = userId.Value
                });

                await Clients.Group(chatId.ToString()).SendAsync("GroupUpdated", "user_left", userId.Value);
            }
            catch (Exception ex)
            {
                await Clients.Caller.SendAsync("Error", $"Ошибка при выходе из группы: {ex.Message}");
            }
        }

        public async Task DeleteGroupChat(Guid chatId)
        {
            try
            {
                var userId = GetCurrentUserId();
                if (userId == null)
                {
                    await Clients.Caller.SendAsync("Error", "Пользователь не авторизован");
                    return;
                }

                var result = await _mediator.Send(new DeleteGroupChatCommand(chatId, userId.Value));
                if (!result.Success)
                {
                    await Clients.Caller.SendAsync("Error", result.ErrorMessage);
                    return;
                }

                var payload = new
                {
                    chatId = chatId,
                    deletedBy = userId.Value
                };

                await Clients.Group(chatId.ToString()).SendAsync("chatdeleted", payload);
                await _chatListHubContext.Clients.All.SendAsync("chatdeleted", payload);
            }
            catch (Exception ex)
            {
                await Clients.Caller.SendAsync("Error", $"Ошибка при удалении группы: {ex.Message}");
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

        private static object? BuildForwardedMessagePayload(Domain.Models.Message? message)
        {
            if (message?.ForwardedFromMessageId == null || message.ForwardedFromMessage == null)
            {
                return null;
            }

            var source = message.ForwardedFromMessage;
            return new
            {
                messageId = source.Id,
                content = source.Content ?? string.Empty,
                senderUsername = source.User?.UserName ?? "Unknown",
                originalChatName = message.ForwardedFromChat?.Name ?? "Unknown Chat",
                forwardedMessageContent = message.ForwardedMessageContent ?? string.Empty,
                contentType = source.ContentType,
                sticker = source.Sticker == null
                    ? null
                    : new
                    {
                        id = source.Sticker.Id,
                        stickerPackId = source.Sticker.StickerPackId,
                        filePath = source.Sticker.FilePath,
                        contentType = source.Sticker.ContentType
                    },
                mediaFiles = source.MediaFiles?.Select(mf => new
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

        private static object? BuildPollPayload(Domain.Models.MessagePoll? poll, Guid? viewerUserId)
        {
            var dto = PollDtoMapper.Map(poll, viewerUserId);
            if (dto == null)
            {
                return null;
            }

            return new
            {
                id = dto.Id,
                question = dto.Question,
                allowMultiple = dto.AllowMultiple,
                isAnonymous = dto.IsAnonymous,
                totalVotes = dto.TotalVotes,
                votedOptionIds = dto.VotedOptionIds,
                options = dto.Options.Select(o => new
                {
                    id = o.Id,
                    text = o.Text,
                    sortOrder = o.SortOrder,
                    voteCount = o.VoteCount,
                    voters = o.Voters.Select(v => new
                    {
                        userId = v.UserId,
                        username = v.Username,
                        avatarUrl = v.AvatarUrl,
                        avatarColor = v.AvatarColor,
                    }).ToList(),
                }).ToList(),
            };
        }
    }
}




