namespace WhithinMessenger.Application.DTOs
{
    public class UserSearchInfo
    {
        public Guid UserId { get; init; }
        public string Username { get; init; } = string.Empty;
        public string? AvatarUrl { get; init; }
        public string? AvatarColor { get; init; }
        public string UserStatus { get; init; } = "offline";
        public DateTimeOffset? LastSeen { get; init; }
        public bool HasExistingChat { get; init; }
    }
}

