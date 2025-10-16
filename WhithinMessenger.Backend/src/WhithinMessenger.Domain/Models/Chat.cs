namespace WhithinMessenger.Domain.Models;

public class Chat
{
    public Guid Id { get; set; }

    public Guid TypeId { get; set; }

    public Guid? CategoryId { get; set; }

    public string? Name { get; set; }

    public Guid? ServerId { get; set; }

    public bool IsPrivate { get; set; }

    public string? AllowedRoleIds { get; set; } 

    public string? Avatar { get; set; }

    public string? AvatarColor { get; set; }

    public DateTimeOffset CreatedAt { get; set; }

    public int? ChatOrder { get; set; }

    public ChatCategory? Category { get; set; }

    public ICollection<Member> Members { get; set; } = new List<Member>();

    public ICollection<Message> Messages { get; set; } = new List<Message>();

    public Server? Server { get; set; }

    public ChatType Type { get; set; } = null!;
}
