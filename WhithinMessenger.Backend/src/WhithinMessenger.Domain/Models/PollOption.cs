namespace WhithinMessenger.Domain.Models;

public class PollOption
{
    public Guid Id { get; set; }

    public Guid PollId { get; set; }

    public string Text { get; set; } = null!;

    public int SortOrder { get; set; }

    public MessagePoll Poll { get; set; } = null!;

    public ICollection<PollVote> Votes { get; set; } = new List<PollVote>();
}
