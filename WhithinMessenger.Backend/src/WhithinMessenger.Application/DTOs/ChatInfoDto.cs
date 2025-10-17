namespace WhithinMessenger.Application.DTOs
{
    public class ChatInfoDto
    {
        public Guid ChatId { get; init; }
        public string Name { get; init; } = string.Empty;
        public string Type { get; init; } = string.Empty;
        public string? Avatar { get; init; }
        public string? AvatarColor { get; init; }
        public string? ChatAvatar { get; init; }
        public string? ChatAvatarColor { get; init; }
        public Guid? OtherUserId { get; init; }
    }
}
