using MediatR;

namespace WhithinMessenger.Application.CommandsAndQueries.Users.SearchUsers
{
    public record SearchUsersQuery(Guid CurrentUserId, string Name) : IRequest<SearchUsersResult>;
}

























