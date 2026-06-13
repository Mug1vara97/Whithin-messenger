namespace WhithinMessenger.Domain.Models;

public class MessagePoll
{
    public Guid Id { get; set; }

    public Guid MessageId { get; set; }

    public string Question { get; set; } = null!;

    public bool AllowMultiple { get; set; }

    public bool IsAnonymous { get; set; } = true;

    public Message Message { get; set; } = null!;

    public ICollection<PollOption> Options { get; set; } = new List<PollOption>();
}
