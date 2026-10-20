using MediatR;
using Microsoft.AspNetCore.SignalR;
using WhithinMessenger.Api.Hubs;
using WhithinMessenger.Application.CommandsAndQueries.User.GetUserProfile;
using WhithinMessenger.Application.Services;
using WhithinMessenger.Domain.Interfaces;
using WhithinMessenger.Domain.Utils;

namespace WhithinMessenger.Api.Services;

public class ChatMessagePublisher : IChatMessagePublisher
{
    private readonly IHubContext<AppHub> _hub;
    private readonly IMediator _mediator;
    private readonly IMessageRepository _messageRepository;
    private readonly IUserRepository _userRepository;
    private readonly IChatRepository _chatRepository;
    private readonly IServerMemberRepository _serverMemberRepository;
    private readonly ChatMessageNotificationService _notifications;
    private readonly IMessageReceiptService _receipts;
    private readonly IBotEventForwarder _botEvents;

    public ChatMessagePublisher(
        IHubContext<AppHub> hub,
        IMediator mediator,
        IMessageRepository messageRepository,
        IUserRepository userRepository,
        IChatRepository chatRepository,
        IServerMemberRepository serverMemberRepository,
        ChatMessageNotificationService notifications,
        IMessageReceiptService receipts,
        IBotEventForwarder botEvents)
    {
        _hub = hub;
        _mediator = mediator;
        _messageRepository = messageRepository;
        _userRepository = userRepository;
        _chatRepository = chatRepository;
        _serverMemberRepository = serverMemberRepository;
        _notifications = notifications;
        _receipts = receipts;
        _botEvents = botEvents;
    }

    public async Task PublishTextMessageAsync(
        Guid chatId,
        Guid senderUserId,
        Guid messageId,
        string content,
        int encryptionVersion = 0,
        Guid? repliedToMessageId = null,
        Guid? forwardedFromMessageId = null,
        CancellationToken cancellationToken = default)
    {
        var senderIdentity = await ResolveSenderIdentityAsync(chatId, senderUserId, cancellationToken);
        var userProfile = await _mediator.Send(new GetUserProfileQuery(senderUserId), cancellationToken);
        var avatarColor = userProfile?.AvatarColor ?? AvatarColorGenerator.GenerateColor(senderUserId);

        object? repliedMessage = null;
        if (repliedToMessageId.HasValue)
        {
            var repliedToMessage = await _messageRepository.GetReplyPreviewAsync(
                repliedToMessageId.Value,
                cancellationToken);
            if (repliedToMessage != null)
            {
                repliedMessage = new
                {
                    messageId = repliedToMessage.Id,
                    content = repliedToMessage.Content,
                    senderUsername = UserDisplayNames.Resolve(
                        repliedToMessage.User?.UserProfile?.DisplayName,
                        repliedToMessage.User?.UserName),
                    createdAt = repliedToMessage.CreatedAt,
                    mediaFiles = repliedToMessage.MediaFiles?.Select(mf => new
                    {
                        id = mf.Id,
                        fileName = mf.FileName,
                        originalFileName = mf.OriginalFileName,
                        filePath = mf.FilePath,
                        contentType = mf.ContentType,
                        fileSize = mf.FileSize,
                        thumbnailPath = mf.ThumbnailPath,
                        createdAt = mf.CreatedAt,
                        isVideoNote = mf.IsVideoNote,
                        durationSeconds = mf.DurationSeconds,
                        streamingManifestPath = mf.StreamingManifestPath
                    }).ToList()
                };
            }
        }

        object? forwardedMessage = null;
        if (forwardedFromMessageId.HasValue)
        {
            var forwardedSource = await _messageRepository.GetByIdWithForwardAsync(messageId, cancellationToken);
            if (forwardedSource?.ForwardedFromMessage != null)
            {
                var source = forwardedSource.ForwardedFromMessage;
                forwardedMessage = new
                {
                    messageId = source.Id,
                    content = source.Content ?? string.Empty,
                    senderUsername = UserDisplayNames.Resolve(
                        source.User?.UserProfile?.DisplayName,
                        source.User?.UserName),
                    originalChatName = forwardedSource.ForwardedFromChat?.Name ?? "Unknown Chat",
                    forwardedMessageContent = forwardedSource.ForwardedMessageContent ?? string.Empty,
                    contentType = source.ContentType,
                };
            }
        }

        await _hub.Clients.Group(HubGroups.Chat(chatId)).SendAsync("MessageSent", new
        {
            messageId,
            senderId = senderUserId,
            content,
            encryptionVersion,
            username = senderIdentity.VisibleName,
            senderDisplayName = senderIdentity.DisplayName,
            senderLogin = senderIdentity.Login,
            chatId,
            avatarUrl = userProfile?.Avatar,
            avatarDecoration = userProfile?.AvatarDecoration,
            avatarColor,
            repliedMessage,
            forwardedMessage,
            mediaFiles = (object?)null,
            status = MessageStatusHelper.Sent,
            isBot = senderIdentity.IsBot,
        }, cancellationToken);

        await _notifications.NotifyTextMessageAsync(
            chatId,
            senderUserId,
            senderIdentity.VisibleName,
            messageId,
            content,
            encryptionVersion: encryptionVersion);

        await _receipts.AutoDeliverToReachableRecipientsAsync(chatId, messageId, senderUserId);

        var chat = await _chatRepository.GetByIdAsync(chatId, cancellationToken);
        await _botEvents.ForwardMessageCreatedAsync(
            chatId,
            messageId,
            senderUserId,
            content,
            senderIdentity.VisibleName,
            chat?.ServerId,
            cancellationToken);
    }

    private async Task<(string VisibleName, string? DisplayName, string Login, bool IsBot)> ResolveSenderIdentityAsync(
        Guid chatId,
        Guid userId,
        CancellationToken cancellationToken)
    {
        var user = await _userRepository.GetByIdAsync(userId, cancellationToken);
        var chat = await _chatRepository.GetByIdAsync(chatId, cancellationToken);
        string? serverNickname = null;
        if (chat?.ServerId is Guid serverId)
        {
            serverNickname = await _serverMemberRepository.GetNicknameAsync(serverId, userId, cancellationToken);
        }

        var visibleName = ServerMemberNames.Resolve(
            serverNickname,
            user?.UserProfile?.DisplayName,
            user?.UserName);

        return (
            visibleName,
            UserDisplayNames.Normalize(user?.UserProfile?.DisplayName),
            user?.UserName ?? string.Empty,
            user?.IsBot ?? false);
    }
}
