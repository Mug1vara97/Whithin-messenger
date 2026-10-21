namespace WhithinMessenger.Domain.Models;

public class ServerEvent
{
    public Guid Id { get; set; }

    public Guid ServerId { get; set; }

    public Guid CreatedByUserId { get; set; }

    public string Title { get; set; } = string.Empty;

    public string? Description { get; set; }

    public DateTimeOffset StartsAt { get; set; }

    public DateTimeOffset? EndsAt { get; set; }

    public ServerEventLocationType LocationType { get; set; }

    public Guid? ChannelId { get; set; }

    public string? ExternalLocation { get; set; }

    public ServerEventStatus Status { get; set; } = ServerEventStatus.Scheduled;

    public DateTimeOffset CreatedAt { get; set; }

    public DateTimeOffset UpdatedAt { get; set; }

    public Server Server { get; set; } = null!;

    public ApplicationUser CreatedBy { get; set; } = null!;

    public Chat? Channel { get; set; }

    public ICollection<ServerEventRsvp> Rsvps { get; set; } = new List<ServerEventRsvp>();
}
