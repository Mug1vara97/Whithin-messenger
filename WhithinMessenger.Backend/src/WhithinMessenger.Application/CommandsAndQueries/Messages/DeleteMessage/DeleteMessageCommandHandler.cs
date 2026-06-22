using MediatR;
using WhithinMessenger.Application.Services;
using WhithinMessenger.Domain.Interfaces;

namespace WhithinMessenger.Application.CommandsAndQueries.Messages.DeleteMessage;

public class DeleteMessageCommandHandler : IRequestHandler<DeleteMessageCommand, DeleteMessageResult>
{
    private readonly IMessageRepository _messageRepository;
    private readonly IMediaFileRepository _mediaFileRepository;
    private readonly IMediaFileStorageCleanup _mediaFileStorageCleanup;
    private readonly IChatRepository _chatRepository;
    private readonly ServerPermissionChecker _permissionChecker;
    private readonly IServerAuditLogService _auditLog;
    private readonly IUserListCacheService _userListCache;

    public DeleteMessageCommandHandler(
        IMessageRepository messageRepository,
        IMediaFileRepository mediaFileRepository,
        IMediaFileStorageCleanup mediaFileStorageCleanup,
        IChatRepository chatRepository,
        ServerPermissionChecker permissionChecker,
        IServerAuditLogService auditLog,
        IUserListCacheService userListCache)
    {
        _messageRepository = messageRepository;
        _mediaFileRepository = mediaFileRepository;
        _mediaFileStorageCleanup = mediaFileStorageCleanup;
        _chatRepository = chatRepository;
        _permissionChecker = permissionChecker;
        _auditLog = auditLog;
        _userListCache = userListCache;
    }

    public async Task<DeleteMessageResult> Handle(DeleteMessageCommand request, CancellationToken cancellationToken)
    {
        try
        {
            var message = await _messageRepository.GetByIdAsync(request.MessageId, cancellationToken);

            if (message == null)
            {
                return new DeleteMessageResult
                {
                    Success = false,
                    ErrorMessage = "Message not found"
                };
            }

            var chat = await _chatRepository.GetByIdAsync(message.ChatId, cancellationToken);
            var moderationCheck = await _permissionChecker.ValidateMessageModerationAsync(
                chat?.ServerId,
                request.UserId,
                message.UserId,
                cancellationToken);

            if (!moderationCheck.Allowed)
            {
                return new DeleteMessageResult
                {
                    Success = false,
                    ErrorMessage = moderationCheck.ErrorMessage
                };
            }

            var mediaFiles = await _mediaFileRepository.GetAllByMessageIdAsync(request.MessageId, cancellationToken);
            await _mediaFileStorageCleanup.DeleteMediaAssetsAsync(mediaFiles, cancellationToken);

            await _messageRepository.DeleteAsync(request.MessageId, cancellationToken);

            if (chat?.ServerId != null)
            {
                var preview = string.IsNullOrWhiteSpace(message.Content)
                    ? "Сообщение без текста"
                    : (message.Content.Length > 80 ? message.Content[..80] + "…" : message.Content);

                await _auditLog.LogAsync(
                    chat.ServerId.Value,
                    request.UserId,
                    AuditLogActionTypes.MessageDelete,
                    AuditLogTargetTypes.Message,
                    request.MessageId,
                    new
                    {
                        targetName = chat.Name,
                        detail = preview,
                        channelId = chat.Id,
                        messageAuthorId = message.UserId,
                    },
                    cancellationToken);
            }

            if (chat != null && !chat.ServerId.HasValue)
            {
                await _userListCache.InvalidateChatListForChatAsync(message.ChatId, cancellationToken);
            }

            return new DeleteMessageResult
            {
                Success = true
            };
        }
        catch (Exception ex)
        {
            return new DeleteMessageResult
            {
                Success = false,
                ErrorMessage = ex.Message
            };
        }
    }
}
