using MediatR;
using WhithinMessenger.Domain.Interfaces;
using WhithinMessenger.Application.DTOs;
using WhithinMessenger.Application.Interfaces;

namespace WhithinMessenger.Application.CommandsAndQueries.Friends.GetFriends;

public class GetFriendsQueryHandler : IRequestHandler<GetFriendsQuery, GetFriendsResult>
{
    private readonly IFriendshipRepository _friendshipRepository;
    private readonly IUserProfileRepository _userProfileRepository;

    public GetFriendsQueryHandler(IFriendshipRepository friendshipRepository, IUserProfileRepository userProfileRepository)
    {
        _friendshipRepository = friendshipRepository;
        _userProfileRepository = userProfileRepository;
    }

    public async Task<GetFriendsResult> Handle(GetFriendsQuery request, CancellationToken cancellationToken)
    {
        var friendships = await _friendshipRepository.GetFriendsAsync(request.UserId, cancellationToken);
        
        var friends = new List<FriendDto>();
        
        foreach (var friendship in friendships)
        {
            var friendUser = friendship.RequesterId == request.UserId ? friendship.Addressee : friendship.Requester;
            var friendProfile = await _userProfileRepository.GetByUserIdAsync(friendUser.Id, cancellationToken);
            
            friends.Add(new FriendDto
            {
                UserId = friendUser.Id,
                Username = friendUser.UserName ?? string.Empty,
                Avatar = friendProfile?.Avatar,
                AvatarColor = friendProfile?.AvatarColor,
                Description = friendProfile?.Description,
                Status = friendUser.Status,
                LastSeen = friendUser.LastSeen,
                FriendshipCreatedAt = friendship.UpdatedAt ?? friendship.CreatedAt
            });
        }
        
        return new GetFriendsResult(friends);
    }
}


