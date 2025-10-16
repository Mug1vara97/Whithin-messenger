namespace WhithinMessenger.Application.CommandsAndQueries.Messages.GetMessages;

public class MessageDto
{
    public Guid MessageId { get; set; }
    public string Content { get; set; } = string.Empty;
    public DateTimeOffset CreatedAt { get; set; }
    public string SenderUsername { get; set; } = string.Empty;
    public string? AvatarUrl { get; set; }
    public string AvatarColor { get; set; } = string.Empty;
    public ReplyMessageDto? RepliedMessage { get; set; }
    public ForwardedMessageDto? ForwardedMessage { get; set; }
    public List<MediaFileDto> MediaFiles { get; set; } = new();
}

public class MediaFileDto
{
    public Guid Id { get; set; }
    public string FileName { get; set; } = string.Empty;
    public string OriginalFileName { get; set; } = string.Empty;
    public string FilePath { get; set; } = string.Empty;
    public string ContentType { get; set; } = string.Empty;
    public long FileSize { get; set; }
    public string? ThumbnailPath { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}

public class ReplyMessageDto
{
    public Guid MessageId { get; set; }
    public string Content { get; set; } = string.Empty;
    public string SenderUsername { get; set; } = string.Empty;
    public List<MediaFileDto> MediaFiles { get; set; } = new();
}

public class ForwardedMessageDto
{
    public Guid MessageId { get; set; }
    public string Content { get; set; } = string.Empty;
    public string SenderUsername { get; set; } = string.Empty;
    public string OriginalChatName { get; set; } = string.Empty;
    public string ForwardedByUsername { get; set; } = string.Empty;
    public string ForwardedMessageContent { get; set; } = string.Empty;
}









