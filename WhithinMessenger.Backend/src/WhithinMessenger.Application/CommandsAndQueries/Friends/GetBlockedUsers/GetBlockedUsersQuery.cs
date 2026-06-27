using MediatR;

namespace WhithinMessenger.Application.CommandsAndQueries.Friends.GetBlockedUsers;

public record GetBlockedUsersQuery(Guid UserId) : IRequest<GetBlockedUsersResult>;
