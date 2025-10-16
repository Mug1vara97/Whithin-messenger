using WhithinMessenger.Domain.Models;

namespace WhithinMessenger.Application.DTOs;

public class FriendDto
{
    public Guid UserId { get; init; }
    public string Username { get; init; } = string.Empty;
    public string? Avatar { get; init; }
    public string? AvatarColor { get; init; }
    public string? Description { get; init; }
    public Status Status { get; init; }
    public DateTimeOffset? LastSeen { get; init; }
    public DateTimeOffset FriendshipCreatedAt { get; init; }
}

public class FriendRequestDto
{
    public Guid Id { get; init; }
    public Guid RequesterId { get; init; }
    public Guid AddresseeId { get; init; }
    public string RequesterUsername { get; init; } = string.Empty;
    public string? RequesterAvatar { get; init; }
    public string? RequesterAvatarColor { get; init; }
    public DateTimeOffset CreatedAt { get; init; }
}
