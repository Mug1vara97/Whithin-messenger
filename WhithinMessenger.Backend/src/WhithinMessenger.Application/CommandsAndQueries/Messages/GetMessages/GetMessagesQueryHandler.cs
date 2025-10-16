using MediatR;
using WhithinMessenger.Domain.Models;
using WhithinMessenger.Domain.Interfaces;

namespace WhithinMessenger.Application.CommandsAndQueries.Messages.GetMessages;

public class GetMessagesQueryHandler : IRequestHandler<GetMessagesQuery, GetMessagesResult>
{
    private readonly IMessageRepository _messageRepository;

    public GetMessagesQueryHandler(IMessageRepository messageRepository)
    {
        _messageRepository = messageRepository;
    }

    public async Task<GetMessagesResult> Handle(GetMessagesQuery request, CancellationToken cancellationToken)
    {
        try
        {
            var messages = await _messageRepository.GetByChatIdAsync(request.ChatId, cancellationToken);

            var messageDtos = messages.Select(m =>
            {
                var dto = new MessageDto
                {
                    MessageId = m.Id,
                    Content = m.Content,
                    CreatedAt = m.CreatedAt,
                    SenderUsername = m.User.UserName ?? "Unknown",
                    AvatarUrl = m.User.UserProfile?.Avatar,
                    AvatarColor = !string.IsNullOrEmpty(m.User.UserProfile?.AvatarColor)
                        ? m.User.UserProfile.AvatarColor
                        : GenerateAvatarColor(m.UserId),
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
                                CreatedAt = mf.CreatedAt
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
                    MediaFiles = m.MediaFiles?.Select(mf => new MediaFileDto
                    {
                        Id = mf.Id,
                        FileName = mf.FileName,
                        OriginalFileName = mf.OriginalFileName,
                        FilePath = mf.FilePath,
                        ContentType = mf.ContentType,
                        FileSize = mf.FileSize,
                        ThumbnailPath = mf.ThumbnailPath,
                        CreatedAt = mf.CreatedAt
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
