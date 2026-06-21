using MediatR;

namespace WhithinMessenger.Application.CommandsAndQueries.Chats.ReorderPinnedChats;

public class ReorderPinnedChatsCommand : IRequest<ReorderPinnedChatsResult>
{
    public Guid UserId { get; }
    public IReadOnlyList<Guid> ChatIds { get; }

    public ReorderPinnedChatsCommand(Guid userId, IReadOnlyList<Guid> chatIds)
    {
        UserId = userId;
        ChatIds = chatIds;
    }
}
