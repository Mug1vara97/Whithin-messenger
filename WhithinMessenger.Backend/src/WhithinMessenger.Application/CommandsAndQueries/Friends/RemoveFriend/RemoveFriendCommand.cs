using MediatR;

namespace WhithinMessenger.Application.CommandsAndQueries.Friends.RemoveFriend;

public record RemoveFriendCommand(Guid UserId, Guid FriendId) : IRequest<RemoveFriendResult>;








