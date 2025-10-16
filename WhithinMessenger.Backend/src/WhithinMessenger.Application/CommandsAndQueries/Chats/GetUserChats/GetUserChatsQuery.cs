using MediatR;

namespace WhithinMessenger.Application.CommandsAndQueries.Chats.GetUserChats
{
    public record GetUserChatsQuery(Guid UserId) : IRequest<GetUserChatsResult>;
}

























