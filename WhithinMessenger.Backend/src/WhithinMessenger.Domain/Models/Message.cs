namespace WhithinMessenger.Domain.Models;

public class Message
{
    public Guid Id { get; set; }

    public Guid ChatId { get; set; }

    public Guid UserId { get; set; }

    public string Content { get; set; } = null!;

    public DateTimeOffset CreatedAt { get; set; }

    public string? ContentType { get; set; }
    
    public string? ForwardedMessageContent { get; set; }

    public Guid? RepliedToMessageId { get; set; }

    public Guid? ForwardedFromMessageId { get; set; }

    public Guid? ForwardedFromChatId { get; set; }

    public Guid? ForwardedByUserId { get; set; }

    public Chat Chat { get; set; } = null!;

    public ApplicationUser User { get; set; } = null!;

    public Message? RepliedToMessage { get; set; }

    public Message? ForwardedFromMessage { get; set; }

    public Chat? ForwardedFromChat { get; set; }

    public ApplicationUser? ForwardedByUser { get; set; }

    public ICollection<Message> Replies { get; set; } = new List<Message>();

    public ICollection<MessageRead> MessageReads { get; set; } = new List<MessageRead>();

    public ICollection<MediaFile> MediaFiles { get; set; } = new List<MediaFile>();
}
