using WhithinMessenger.Application.DTOs;

namespace WhithinMessenger.Application.CommandsAndQueries.Friends.GetBlockedUsers;

public record GetBlockedUsersResult(
    IReadOnlyList<BlockedUserDto> BlockedUsers,
    IReadOnlyList<Guid> BlockedByUserIds);
