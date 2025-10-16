using MediatR;

namespace WhithinMessenger.Application.CommandsAndQueries.Chats.CreatePrivateChat
{
    public record CreatePrivateChatCommand(Guid UserId, Guid TargetUserId) : IRequest<CreatePrivateChatResult>;
}

























