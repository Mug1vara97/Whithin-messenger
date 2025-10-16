using WhithinMessenger.Domain.Models;
using WhithinMessenger.Application.DTOs;

namespace WhithinMessenger.Application.CommandsAndQueries.Friends.GetFriendRequests;

public record GetFriendRequestsResult(IEnumerable<FriendRequestDto> PendingRequests, IEnumerable<FriendRequestDto> SentRequests);


