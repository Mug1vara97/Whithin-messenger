using MediatR;
using WhithinMessenger.Domain.Models;

namespace WhithinMessenger.Application.CommandsAndQueries.User.GetUserProfile;

public record GetUserProfileQuery(Guid UserId) : IRequest<UserProfileDto?>;

public record UserProfileDto
{
    public Guid UserId { get; init; }
    public string? Avatar { get; init; }
    public string? AvatarColor { get; init; }
    public string? Description { get; init; }
    public string? Banner { get; init; }
}









