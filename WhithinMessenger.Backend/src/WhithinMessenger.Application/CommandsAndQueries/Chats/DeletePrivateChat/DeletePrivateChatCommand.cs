using MediatR;

namespace WhithinMessenger.Application.CommandsAndQueries.Chats.DeletePrivateChat;

public class DeletePrivateChatCommand : IRequest<DeletePrivateChatResult>
{
    public Guid ChatId { get; set; }
    public Guid UserId { get; set; }

    public DeletePrivateChatCommand(Guid chatId, Guid userId)
    {
        ChatId = chatId;
        UserId = userId;
    }
}