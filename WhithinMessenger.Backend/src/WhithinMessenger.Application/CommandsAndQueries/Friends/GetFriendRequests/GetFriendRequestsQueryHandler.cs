using MediatR;
using WhithinMessenger.Domain.Interfaces;
using WhithinMessenger.Domain.Models;
using WhithinMessenger.Application.DTOs;

namespace WhithinMessenger.Application.CommandsAndQueries.Friends.GetFriendRequests;

public class GetFriendRequestsQueryHandler : IRequestHandler<GetFriendRequestsQuery, GetFriendRequestsResult>
{
    private readonly IFriendshipRepository _friendshipRepository;
    private readonly IUserProfileRepository _userProfileRepository;

    public GetFriendRequestsQueryHandler(IFriendshipRepository friendshipRepository, IUserProfileRepository userProfileRepository)
    {
        _friendshipRepository = friendshipRepository;
        _userProfileRepository = userProfileRepository;
    }

    public async Task<GetFriendRequestsResult> Handle(GetFriendRequestsQuery request, CancellationToken cancellationToken)
    {
        var pendingRequests = await _friendshipRepository.GetPendingRequestsAsync(request.UserId, cancellationToken);
        var sentRequests = await _friendshipRepository.GetSentRequestsAsync(request.UserId, cancellationToken);
        
        var pendingDtos = new List<FriendRequestDto>();
        var sentDtos = new List<FriendRequestDto>();
        
        foreach (var request_friendship in pendingRequests)
        {
            var requesterProfile = await _userProfileRepository.GetByUserIdAsync(request_friendship.RequesterId, cancellationToken);
            
            pendingDtos.Add(new FriendRequestDto
            {
                Id = request_friendship.Id,
                RequesterId = request_friendship.RequesterId,
                AddresseeId = request_friendship.AddresseeId,
                RequesterUsername = request_friendship.Requester.UserName ?? string.Empty,
                RequesterAvatar = requesterProfile?.Avatar,
                RequesterAvatarColor = requesterProfile?.AvatarColor,
                CreatedAt = request_friendship.CreatedAt
            });
        }
        
        foreach (var request_friendship in sentRequests)
        {
            var addresseeProfile = await _userProfileRepository.GetByUserIdAsync(request_friendship.AddresseeId, cancellationToken);
            
            sentDtos.Add(new FriendRequestDto
            {
                Id = request_friendship.Id,
                RequesterId = request_friendship.RequesterId,
                AddresseeId = request_friendship.AddresseeId,
                RequesterUsername = request_friendship.Addressee.UserName ?? string.Empty,
                RequesterAvatar = addresseeProfile?.Avatar,
                RequesterAvatarColor = addresseeProfile?.AvatarColor,
                CreatedAt = request_friendship.CreatedAt
            });
        }
        
        return new GetFriendRequestsResult(pendingDtos, sentDtos);
    }
}



