namespace WhithinMessenger.Domain.Models;

public class ServerEventRsvp
{
    public Guid EventId { get; set; }

    public Guid UserId { get; set; }

    public ServerEventInterest Interest { get; set; }

    public DateTimeOffset UpdatedAt { get; set; }

    public ServerEvent Event { get; set; } = null!;

    public ApplicationUser User { get; set; } = null!;
}
