using WhithinMessenger.Domain.Models;

namespace WhithinMessenger.Application.CommandsAndQueries.Messages.GetMessages;

internal static class ForwardedMessageDtoMapper
{
    internal static ForwardedMessageDto? Map(
        Message? source,
        string? originalChatName,
        string? forwardedByUsername,
        string? forwardedMessageContent)
    {
        if (source == null)
        {
            return null;
        }

        return new ForwardedMessageDto
        {
            MessageId = source.Id,
            Content = source.Content,
            SenderUsername = source.User?.UserName ?? "Unknown",
            OriginalChatName = originalChatName ?? "Unknown Chat",
            ForwardedByUsername = forwardedByUsername ?? "Unknown",
            ForwardedMessageContent = forwardedMessageContent ?? string.Empty,
            ContentType = source.ContentType,
            Sticker = source.Sticker == null
                ? null
                : new StickerMessageDto
                {
                    Id = source.Sticker.Id,
                    StickerPackId = source.Sticker.StickerPackId,
                    FilePath = source.Sticker.FilePath,
                    ContentType = source.Sticker.ContentType
                },
            MediaFiles = source.MediaFiles?.Select(MessageDtoMappers.MapMediaFile).ToList() ?? new List<MediaFileDto>()
        };
    }
}

internal static class MessageDtoMappers
{
    internal static MediaFileDto MapMediaFile(MediaFile mediaFile) =>
        new()
        {
            Id = mediaFile.Id,
            FileName = mediaFile.FileName,
            OriginalFileName = mediaFile.OriginalFileName,
            FilePath = mediaFile.FilePath,
            ContentType = mediaFile.ContentType,
            FileSize = mediaFile.FileSize,
            ThumbnailPath = mediaFile.ThumbnailPath,
            CreatedAt = mediaFile.CreatedAt,
            IsVideoNote = mediaFile.IsVideoNote,
            DurationSeconds = mediaFile.DurationSeconds,
            StreamingManifestPath = mediaFile.StreamingManifestPath
        };
}
