namespace WhithinMessenger.Domain.Models;

public class ServerMember
{
    public Guid Id { get; set; }

    public Guid ServerId { get; set; }

    public Guid UserId { get; set; }

    public DateTimeOffset JoinedAt { get; set; }

    public Server Server { get; set; } = null!;

    public ApplicationUser User { get; set; } = null!;
}
