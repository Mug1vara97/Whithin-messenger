namespace WhithinMessenger.Application.DTOs
{
    public class ChatInfoDto
    {
        public Guid ChatId { get; init; }
        public string Name { get; init; } = string.Empty;
        public string Type { get; init; } = string.Empty;
        public string? Avatar { get; init; }
        public string? AvatarColor { get; init; }
        public string? ChatAvatar { get; init; } // Аватар самого чата (для групповых чатов)
        public string? ChatAvatarColor { get; init; } // Цвет аватара чата
        public Guid? OtherUserId { get; init; } // ID другого пользователя в приватном чате
    }
}
