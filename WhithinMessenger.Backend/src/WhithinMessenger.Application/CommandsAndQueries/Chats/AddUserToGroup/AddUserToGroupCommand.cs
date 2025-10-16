using MediatR;

namespace WhithinMessenger.Application.CommandsAndQueries.Chats.AddUserToGroup
{
    public record AddUserToGroupCommand(Guid GroupChatId, Guid UserId, Guid CurrentUserId) : IRequest<AddUserToGroupResult>;
}










