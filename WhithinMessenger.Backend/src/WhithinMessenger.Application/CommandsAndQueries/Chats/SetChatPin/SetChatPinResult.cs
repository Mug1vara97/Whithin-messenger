namespace WhithinMessenger.Application.CommandsAndQueries.Chats.SetChatPin;

public class SetChatPinResult
{
    public bool Success { get; init; }
    public string? ErrorMessage { get; init; }
    public bool IsPinned { get; init; }
    public DateTimeOffset? PinnedAt { get; init; }
}
