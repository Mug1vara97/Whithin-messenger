namespace WhithinMessenger.Domain.Models;

public class ChatType
{
    public Guid Id { get; set; }

    public string TypeName { get; set; } = null!;

    public ICollection<Chat> Chats { get; set; } = [];
}
