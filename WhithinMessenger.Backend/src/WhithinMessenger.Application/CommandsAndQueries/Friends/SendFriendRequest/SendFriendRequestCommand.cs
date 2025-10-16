using MediatR;

namespace WhithinMessenger.Application.CommandsAndQueries.Friends.SendFriendRequest;

public record SendFriendRequestCommand(Guid RequesterId, Guid AddresseeId) : IRequest<SendFriendRequestResult>;








