using MediatR;
using WhithinMessenger.Domain.Models;

namespace WhithinMessenger.Application.CommandsAndQueries.Friends.GetFriendRequests;

public record GetFriendRequestsQuery(Guid UserId) : IRequest<GetFriendRequestsResult>;








