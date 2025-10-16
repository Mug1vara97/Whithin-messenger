using MediatR;

namespace WhithinMessenger.Application.CommandsAndQueries.Friends.AcceptFriendRequest;

public record AcceptFriendRequestCommand(Guid UserId, Guid FriendshipId) : IRequest<AcceptFriendRequestResult>;








