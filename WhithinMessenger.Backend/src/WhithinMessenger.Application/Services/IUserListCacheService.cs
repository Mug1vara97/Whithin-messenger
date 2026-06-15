using WhithinMessenger.Application.Models;
using WhithinMessenger.Domain.Interfaces;

namespace WhithinMessenger.Application.Services;

public interface IUserListCacheService
{
    Task<List<ChatInfo>?> GetUserChatsAsync(Guid userId, CancellationToken cancellationToken = default);

    Task SetUserChatsAsync(Guid userId, List<ChatInfo> chats, CancellationToken cancellationToken = default);

    Task<List<CachedUserServerItem>?> GetUserServersAsync(Guid userId, CancellationToken cancellationToken = default);

    Task SetUserServersAsync(Guid userId, List<CachedUserServerItem> servers, CancellationToken cancellationToken = default);

    Task InvalidateUserChatsAsync(Guid userId, CancellationToken cancellationToken = default);

    Task InvalidateUserChatsAsync(IEnumerable<Guid> userIds, CancellationToken cancellationToken = default);

    Task InvalidateUserServersAsync(Guid userId, CancellationToken cancellationToken = default);

    Task InvalidateChatListForChatAsync(Guid chatId, CancellationToken cancellationToken = default);
}
