using MediatR;
using WhithinMessenger.Domain.Interfaces;

namespace WhithinMessenger.Application.CommandsAndQueries.Messages.GetMessages;

public class GetMessagesQueryHandler : IRequestHandler<GetMessagesQuery, GetMessagesResult>
{
    private readonly IMessageRepository _messageRepository;
    private readonly IChatRepository _chatRepository;

    public GetMessagesQueryHandler(IMessageRepository messageRepository, IChatRepository chatRepository)
    {
        _messageRepository = messageRepository;
        _chatRepository = chatRepository;
    }

    public async Task<GetMessagesResult> Handle(GetMessagesQuery request, CancellationToken cancellationToken)
    {
        try
        {
            var messages = await _messageRepository.GetByChatIdAsync(request.ChatId, cancellationToken);
            var chatMembers = await _chatRepository.GetChatMembersAsync(request.ChatId, cancellationToken);
            var recipientCount = Math.Max(0, chatMembers.Count - 1);

            Dictionary<Guid, string> statuses = new();
            if (request.UserId.HasValue && recipientCount > 0)
            {
                var ownMessageIds = messages
                    .Where(m => m.UserId == request.UserId.Value)
                    .Select(m => m.Id)
                    .ToList();

                statuses = await _messageRepository.GetMessageStatusesAsync(
                    request.UserId.Value,
                    ownMessageIds,
                    recipientCount,
                    cancellationToken);
            }

            var messageDtos = messages.Select(m =>
            {
                var dto = new MessageDto
                {
                    MessageId = m.Id,
                    SenderId = m.UserId,
                    Content = m.Content,
                    ContentType = m.ContentType,
                    CreatedAt = m.CreatedAt,
                    SenderUsername = m.User.UserName ?? "Unknown",
                    AvatarUrl = m.User.UserProfile?.Avatar,
                    AvatarColor = !string.IsNullOrEmpty(m.User.UserProfile?.AvatarColor)
                        ? m.User.UserProfile.AvatarColor
                        : GenerateAvatarColor(m.UserId),
                    Status = request.UserId.HasValue && m.UserId == request.UserId.Value
                        ? statuses.GetValueOrDefault(m.Id, MessageStatusHelper.Sent)
                        : null,
                    RepliedMessage = m.RepliedToMessageId != null && m.RepliedToMessage != null
                        ? new ReplyMessageDto
                        {
                            MessageId = m.RepliedToMessage.Id,
                            Content = m.RepliedToMessage.Content,
                            SenderUsername = m.RepliedToMessage.User?.UserName ?? "Unknown",
                            MediaFiles = m.RepliedToMessage.MediaFiles?.Select(mf => new MediaFileDto
                            {
                                Id = mf.Id,
                                FileName = mf.FileName,
                                OriginalFileName = mf.OriginalFileName,
                                FilePath = mf.FilePath,
                                ContentType = mf.ContentType,
                                FileSize = mf.FileSize,
                                ThumbnailPath = mf.ThumbnailPath,
                                CreatedAt = mf.CreatedAt,
                                IsVideoNote = mf.IsVideoNote
                            }).ToList() ?? new List<MediaFileDto>()
                        }
                        : null,
                    ForwardedMessage = m.ForwardedFromMessageId != null && m.ForwardedFromMessage != null
                        ? new ForwardedMessageDto
                        {
                            MessageId = m.ForwardedFromMessage.Id,
                            Content = m.ForwardedFromMessage.Content,
                            SenderUsername = m.ForwardedFromMessage.User?.UserName ?? "Unknown",
                            OriginalChatName = m.ForwardedFromChat?.Name ?? "Unknown Chat",
                            ForwardedByUsername = m.ForwardedByUser?.UserName ?? "Unknown",
                            ForwardedMessageContent = m.ForwardedMessageContent ?? ""
                        }
                        : null,
                    Sticker = m.Sticker == null
                        ? null
                        : new StickerMessageDto
                        {
                            Id = m.Sticker.Id,
                            StickerPackId = m.Sticker.StickerPackId,
                            FilePath = m.Sticker.FilePath,
                            ContentType = m.Sticker.ContentType
                        },
                    MediaFiles = m.MediaFiles?.Select(mf => new MediaFileDto
                    {
                        Id = mf.Id,
                        FileName = mf.FileName,
                        OriginalFileName = mf.OriginalFileName,
                        FilePath = mf.FilePath,
                        ContentType = mf.ContentType,
                        FileSize = mf.FileSize,
                        ThumbnailPath = mf.ThumbnailPath,
                        CreatedAt = mf.CreatedAt,
                        IsVideoNote = mf.IsVideoNote
                    }).ToList() ?? new List<MediaFileDto>()
                };

                return dto;
            }).ToList();

            return new GetMessagesResult
            {
                Success = true,
                Messages = messageDtos
            };
        }
        catch (Exception ex)
        {
            return new GetMessagesResult
            {
                Success = false,
                ErrorMessage = ex.Message
            };
        }
    }

    private static string GenerateAvatarColor(Guid userId) 
    {
        string[] colors = { "#5865F2", "#EB459E", "#ED4245", "#FEE75C", "#57F287", "#FAA61A" };
        int index = Math.Abs(userId.GetHashCode()) % colors.Length;
        return colors[index];
    }
}
