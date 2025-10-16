namespace WhithinMessenger.Application.CommandsAndQueries.Chats.DeletePrivateChat;

public class DeletePrivateChatResult
{
    public bool Success { get; set; }
    public string? ErrorMessage { get; set; }
    public List<Guid>? Participants { get; set; }
}