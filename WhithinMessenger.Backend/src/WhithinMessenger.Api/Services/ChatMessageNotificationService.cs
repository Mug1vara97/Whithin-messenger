using Microsoft.AspNetCore.SignalR;
using WhithinMessenger.Api.Hubs;
using WhithinMessenger.Application.Services;
using WhithinMessenger.Domain.Interfaces;

namespace WhithinMessenger.Api.Services;

public class ChatMessageNotificationService
{
    private readonly INotificationService _notificationService;
    private readonly IChatRepository _chatRepository;
    private readonly IMessageRepository _messageRepository;
    private readonly IHubContext<ChatListHub> _chatListHubContext;
    private readonly ILogger<ChatMessageNotificationService> _logger;

    public ChatMessageNotificationService(
        INotificationService notificationService,
        IChatRepository chatRepository,
        IMessageRepository messageRepository,
        IHubContext<ChatListHub> chatListHubContext,
        ILogger<ChatMessageNotificationService> logger)
    {
        _notificationService = notificationService;
        _chatRepository = chatRepository;
        _messageRepository = messageRepository;
        _chatListHubContext = chatListHubContext;
        _logger = logger;
    }

    public Task NotifyTextMessageAsync(
        Guid chatId,
        Guid senderId,
        string senderUsername,
        Guid? messageId,
        string text,
        CancellationToken cancellationToken = default)
    {
        var (messageType, previewText) = ChatMessagePreviewBuilder.Build(
            contentType: null,
            textContent: text,
            mediaContentType: null);

        return NotifyAsync(
            chatId,
            senderId,
            senderUsername,
            messageId,
            messageType,
            previewText,
            thumbnailPath: null,
            cancellationToken);
    }

    public Task NotifyMediaMessageAsync(
        Guid chatId,
        Guid senderId,
        string senderUsername,
        Guid? messageId,
        string? caption,
        string mediaContentType,
        bool isVideoNote,
        string? thumbnailPath,
        string? filePath,
        CancellationToken cancellationToken = default)
    {
        var (messageType, previewText) = ChatMessagePreviewBuilder.Build(
            contentType: "media",
            textContent: caption,
            mediaContentType: mediaContentType,
            isVideoNote: isVideoNote);

        var thumbnail = thumbnailPath ?? filePath;

        return NotifyAsync(
            chatId,
            senderId,
            senderUsername,
            messageId,
            messageType,
            previewText,
            thumbnail,
            cancellationToken);
    }

    public Task NotifyStickerMessageAsync(
        Guid chatId,
        Guid senderId,
        string senderUsername,
        Guid? messageId,
        string? stickerFilePath,
        CancellationToken cancellationToken = default)
    {
        var (messageType, previewText) = ChatMessagePreviewBuilder.Build(
            contentType: "sticker",
            textContent: null,
            mediaContentType: null);

        return NotifyAsync(
            chatId,
            senderId,
            senderUsername,
            messageId,
            messageType,
            previewText,
            stickerFilePath,
            cancellationToken);
    }

    private async Task NotifyAsync(
        Guid chatId,
        Guid senderId,
        string senderUsername,
        Guid? messageId,
        string messageType,
        string previewText,
        string? thumbnailPath,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var chat = await _chatRepository.GetByIdAsync(chatId);
            if (chat == null)
            {
                return;
            }

            var chatMembers = await _chatRepository.GetChatMembersAsync(chatId);
            var notificationMembers = chatMembers.Where(m => m != senderId).ToList();

            var isGroupChat = chat.Type?.TypeName == "Group";
            var chatName = string.IsNullOrWhiteSpace(chat.Name) ? senderUsername : chat.Name;
            var cleanPreview = string.IsNullOrWhiteSpace(previewText) ? "Новое сообщение" : previewText;
            var truncatedPreview = cleanPreview.Length > 140 ? cleanPreview[..140] : cleanPreview;
            var notificationContent = isGroupChat
                ? $"{senderUsername} в {chatName}: {truncatedPreview}"
                : $"{senderUsername}: {truncatedPreview}";

            var thumbnailUrl = ChatMessagePreviewBuilder.BuildPublicMediaUrl(thumbnailPath);

            await _chatListHubContext.Clients.All.SendAsync(
                "chatupdated",
                chatId,
                truncatedPreview,
                DateTimeOffset.UtcNow,
                cancellationToken);

            if (!notificationMembers.Any())
            {
                return;
            }

            var notificationType = isGroupChat ? "group_message" : "direct_message";

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
                    pushChatTitle,
                    pushMessageType: messageType,
                    pushPreviewText: truncatedPreview,
                    pushThumbnailUrl: string.IsNullOrWhiteSpace(thumbnailUrl) ? null : thumbnailUrl,
                    cancellationToken: cancellationToken);

                var unreadCount = await _messageRepository.GetUnreadCountByChatAsync(chatId, memberId);
                await _chatListHubContext.Clients.Group($"user-{memberId}")
                    .SendAsync("chatunreadupdated", chatId, unreadCount, cancellationToken);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating notifications for chat message");
        }
    }
}
