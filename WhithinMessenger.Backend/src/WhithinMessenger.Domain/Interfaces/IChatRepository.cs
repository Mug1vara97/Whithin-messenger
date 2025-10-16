using WhithinMessenger.Domain.Models;

namespace WhithinMessenger.Domain.Interfaces
{
    public interface IChatRepository
    {
        Task<List<ChatInfo>> GetUserChatsAsync(Guid userId, CancellationToken cancellationToken = default);
        Task<CreatePrivateChatResult> CreatePrivateChatAsync(Guid userId, Guid targetUserId, CancellationToken cancellationToken = default);
        Task<Chat?> GetByIdAsync(Guid chatId, CancellationToken cancellationToken = default);
        Task<List<Guid>> GetChatMembersAsync(Guid chatId, CancellationToken cancellationToken = default);
        Task<List<ChatParticipantInfo>> GetChatParticipantsAsync(Guid chatId, CancellationToken cancellationToken = default);
    // Метод GetChatInfoAsync перемещен в Application слой
        Task<List<AvailableUserInfo>> GetAvailableUsersForGroupAsync(Guid currentUserId, Guid groupChatId, CancellationToken cancellationToken = default);
        Task<bool> AddUserToGroupAsync(Guid groupChatId, Guid userId, CancellationToken cancellationToken = default);
        Task<List<Chat>> GetByServerIdAsync(Guid serverId, CancellationToken cancellationToken = default);
        Task CreateAsync(Chat chat, CancellationToken cancellationToken = default);
        Task UpdateAsync(Chat chat, CancellationToken cancellationToken = default);
        Task DeleteAsync(Guid chatId, CancellationToken cancellationToken = default);
        Task DeleteAllByServerIdAsync(Guid serverId, CancellationToken cancellationToken = default);
        Task<bool> IsUserParticipantAsync(Guid chatId, Guid userId, CancellationToken cancellationToken = default);
        Task<ChatType?> GetChatTypeByNameAsync(string typeName, CancellationToken cancellationToken = default);
    }

    public class ChatInfo
    {
        public Guid ChatId { get; init; }
        public string Username { get; init; } = string.Empty;
        public Guid UserId { get; init; }
        public string? AvatarUrl { get; init; }
        public string? AvatarColor { get; init; }
        public string UserStatus { get; init; } = "offline";
        public DateTimeOffset? LastSeen { get; init; }
        public bool IsGroupChat { get; init; }
        public string? LastMessage { get; init; }
        public DateTimeOffset LastMessageTime { get; init; }
    }

    public interface ICreatePrivateChatResult
    {
        Guid ChatId { get; }
        bool Exists { get; }
        bool Success { get; }
        string? ErrorMessage { get; }
    }

    public class CreatePrivateChatResult : ICreatePrivateChatResult
    {
        public Guid ChatId { get; init; }
        public bool Exists { get; init; }
        public bool Success { get; init; }
        public string? ErrorMessage { get; init; }
    }

    public class ChatParticipantInfo
    {
        public Guid UserId { get; init; }
        public string Username { get; init; } = string.Empty;
        public string? AvatarUrl { get; init; }
        public string? AvatarColor { get; init; }
        public string UserStatus { get; init; } = "offline";
        public DateTimeOffset? LastSeen { get; init; }
    }
}
