using MediatR;

namespace WhithinMessenger.Application.CommandsAndQueries.Friends.DeclineFriendRequest;

public record DeclineFriendRequestCommand(Guid UserId, Guid FriendshipId) : IRequest<DeclineFriendRequestResult>;








