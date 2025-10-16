namespace WhithinMessenger.Domain.Models;

public class Member
{
    public Guid Id { get; set; }

    public Guid UserId { get; set; }

    public Guid ChatId { get; set; }

    public DateTimeOffset JoinedAt { get; set; }

    public required Chat Chat { get; set; }

    public required ApplicationUser User { get; set; }
}