namespace WhithinMessenger.Application.CommandsAndQueries.Friends.SendFriendRequest;

public record SendFriendRequestResult(bool Success, string? ErrorMessage = null, Guid? FriendshipId = null);








