using MediatR;
using WhithinMessenger.Domain.Models;

namespace WhithinMessenger.Application.CommandsAndQueries.Friends.GetFriends;

public record GetFriendsQuery(Guid UserId) : IRequest<GetFriendsResult>;








