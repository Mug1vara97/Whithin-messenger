using WhithinMessenger.Application.DTOs;

namespace WhithinMessenger.Application.CommandsAndQueries.Friends.GetFriends;

public record GetFriendsResult(IEnumerable<FriendDto> Friends);







