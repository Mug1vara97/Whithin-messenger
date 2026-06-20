using WhithinMessenger.Application.Services;
using WhithinMessenger.Domain.Models;

namespace WhithinMessenger.Application.CommandsAndQueries.Messages.GetMessages;

public static class MessageDtoMapper
{
    public static MessageDto Map(
        Message message,
        Guid? viewerUserId = null,
        IReadOnlyDictionary<Guid, string?>? serverNicknamesByUserId = null)
    {
        return new MessageDto
        {
            MessageId = message.Id,
            SenderId = message.UserId,
            Content = message.Content,
            ContentType = message.ContentType,
            CreatedAt = message.CreatedAt,
            SenderUsername = ResolveSenderUsername(message, serverNicknamesByUserId),
            AvatarUrl = message.User?.UserProfile?.Avatar,
            AvatarDecoration = message.User?.UserProfile?.AvatarDecoration,
            AvatarColor = !string.IsNullOrEmpty(message.User?.UserProfile?.AvatarColor)
                ? message.User!.UserProfile!.AvatarColor!
                : GenerateAvatarColor(message.UserId),
            IsPinned = message.IsPinned,
            PinnedAt = message.PinnedAt,
            RepliedMessage = message.RepliedToMessageId != null && message.RepliedToMessage != null
                ? new ReplyMessageDto
                {
                    MessageId = message.RepliedToMessage.Id,
                    Content = message.RepliedToMessage.Content,
                    SenderUsername = ResolveSenderUsername(
                        message.RepliedToMessage,
                        serverNicknamesByUserId),
                    MediaFiles = message.RepliedToMessage.MediaFiles?.Select(MessageDtoMappers.MapMediaFile).ToList()
                        ?? new List<MediaFileDto>(),
                }
                : null,
            ForwardedMessage = message.ForwardedFromMessageId != null
                ? ForwardedMessageDtoMapper.Map(
                    message.ForwardedFromMessage,
                    message.ForwardedFromChat?.Name,
                    message.ForwardedByUser?.UserName,
                    message.ForwardedMessageContent)
                : null,
            Sticker = message.Sticker == null
                ? null
                : new StickerMessageDto
                {
                    Id = message.Sticker.Id,
                    StickerPackId = message.Sticker.StickerPackId,
                    FilePath = message.Sticker.FilePath,
                    ContentType = message.Sticker.ContentType,
                },
            MediaFiles = message.MediaFiles?.Select(MessageDtoMappers.MapMediaFile).ToList() ?? new List<MediaFileDto>(),
            Poll = PollDtoMapper.Map(message.Poll, viewerUserId),
        };
    }

    private static string ResolveSenderUsername(
        Message message,
        IReadOnlyDictionary<Guid, string?>? serverNicknamesByUserId)
    {
        string? serverNickname = null;
        if (serverNicknamesByUserId != null &&
            serverNicknamesByUserId.TryGetValue(message.UserId, out var nick))
        {
            serverNickname = nick;
        }

        return ServerMemberNames.Resolve(
            serverNickname,
            message.User?.UserProfile?.DisplayName,
            message.User?.UserName);
    }

    private static string GenerateAvatarColor(Guid userId)
    {
        string[] colors = { "#5865F2", "#EB459E", "#ED4245", "#FEE75C", "#57F287", "#FAA61A" };
        int index = Math.Abs(userId.GetHashCode()) % colors.Length;
        return colors[index];
    }
}
