using MediatR;
using WhithinMessenger.Application.DTOs;
using WhithinMessenger.Application.Interfaces;
using WhithinMessenger.Application.Services;
using WhithinMessenger.Domain.Interfaces;

namespace WhithinMessenger.Application.CommandsAndQueries.Friends.GetBlockedUsers;

public class GetBlockedUsersQueryHandler : IRequestHandler<GetBlockedUsersQuery, GetBlockedUsersResult>
{
    private readonly IFriendshipRepository _friendshipRepository;
    private readonly IUserProfileRepository _userProfileRepository;
    private readonly IUserBlockService _userBlockService;

    public GetBlockedUsersQueryHandler(
        IFriendshipRepository friendshipRepository,
        IUserProfileRepository userProfileRepository,
        IUserBlockService userBlockService)
    {
        _friendshipRepository = friendshipRepository;
        _userProfileRepository = userProfileRepository;
        _userBlockService = userBlockService;
    }

    public async Task<GetBlockedUsersResult> Handle(GetBlockedUsersQuery request, CancellationToken cancellationToken)
    {
        var blockedFriendships = await _friendshipRepository.GetBlockedFriendshipsAsync(request.UserId, cancellationToken);
        var blockedUsers = new List<BlockedUserDto>();

        foreach (var friendship in blockedFriendships)
        {
            var blockedUser = friendship.Addressee;
            var profile = await _userProfileRepository.GetByUserIdAsync(blockedUser.Id, cancellationToken);
            blockedUsers.Add(new BlockedUserDto
            {
                UserId = blockedUser.Id,
                Username = UserDisplayNames.Resolve(profile?.DisplayName, blockedUser.UserName),
                Avatar = profile?.Avatar,
                AvatarColor = profile?.AvatarColor,
                BlockedAt = friendship.UpdatedAt ?? friendship.CreatedAt,
            });
        }

        var blockedByUserIds = await _userBlockService.GetBlockerUserIdsAsync(request.UserId, cancellationToken);
        return new GetBlockedUsersResult(blockedUsers, blockedByUserIds);
    }
}
