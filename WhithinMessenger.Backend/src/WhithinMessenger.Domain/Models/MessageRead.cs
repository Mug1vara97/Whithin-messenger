namespace WhithinMessenger.Domain.Models;

public class MessageRead
{
    public Guid Id { get; set; }

    public Guid MessageId { get; set; }

    public Guid UserId { get; set; }

    public DateTimeOffset ReadAt { get; set; }

    public required Message Message { get; set; } 

    public required ApplicationUser User { get; set; } 
}