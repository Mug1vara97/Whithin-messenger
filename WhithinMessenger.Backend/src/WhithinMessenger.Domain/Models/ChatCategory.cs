namespace WhithinMessenger.Domain.Models;

public class ChatCategory
{
    public Guid Id { get; set; }

    public string? CategoryName { get; set; }

    public Guid ServerId { get; set; }

    public int CategoryOrder { get; set; }

    public bool IsPrivate { get; set; }

    public string? AllowedRoleIds { get; set; } 

    public string? AllowedUserIds { get; set; }

    public virtual ICollection<Chat> Chats { get; set; } = new List<Chat>();

    public virtual Server Server { get; set; } = null!;
}
