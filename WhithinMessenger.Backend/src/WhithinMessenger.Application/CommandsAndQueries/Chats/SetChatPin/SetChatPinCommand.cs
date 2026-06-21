using MediatR;

namespace WhithinMessenger.Application.CommandsAndQueries.Chats.SetChatPin;

public class SetChatPinCommand : IRequest<SetChatPinResult>
{
    public Guid UserId { get; }
    public Guid ChatId { get; }
    public bool IsPinned { get; }

    public SetChatPinCommand(Guid userId, Guid chatId, bool isPinned)
    {
        UserId = userId;
        ChatId = chatId;
        IsPinned = isPinned;
    }
}
