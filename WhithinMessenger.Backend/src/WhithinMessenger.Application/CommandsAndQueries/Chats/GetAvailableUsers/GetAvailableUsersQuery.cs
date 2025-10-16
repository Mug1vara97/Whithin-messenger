using MediatR;

namespace WhithinMessenger.Application.CommandsAndQueries.Chats.GetAvailableUsers
{
    public record GetAvailableUsersQuery(Guid GroupChatId, Guid CurrentUserId) : IRequest<GetAvailableUsersResult>;
}










