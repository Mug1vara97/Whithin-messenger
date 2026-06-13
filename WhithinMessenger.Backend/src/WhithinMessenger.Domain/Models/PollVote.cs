namespace WhithinMessenger.Domain.Models;

public class PollVote
{
    public Guid Id { get; set; }

    public Guid PollOptionId { get; set; }

    public Guid UserId { get; set; }

    public DateTimeOffset CreatedAt { get; set; }

    public PollOption PollOption { get; set; } = null!;

    public ApplicationUser User { get; set; } = null!;
}
