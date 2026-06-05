namespace WhithinMessenger.Domain.Models;

public class MessageDelivery
{
    public Guid Id { get; set; }

    public Guid MessageId { get; set; }

    public Guid UserId { get; set; }

    public DateTimeOffset DeliveredAt { get; set; }

    public required Message Message { get; set; }

    public required ApplicationUser User { get; set; }
}
