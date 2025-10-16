using MediatR;

namespace WhithinMessenger.Application.CommandsAndQueries.Chats.GetChatParticipants
{
    public record GetChatParticipantsQuery(Guid ChatId, Guid UserId) : IRequest<GetChatParticipantsResult>;
}










