using WhithinMessenger.Application.Models;
using WhithinMessenger.Application.Services;
using WhithinMessenger.Domain.Interfaces;

namespace WhithinMessenger.Infrastructure.Services;

/// <summary>Used when Redis is not configured — always reads from database.</summary>
internal sealed class NullUserListCacheService : IUserListCacheService
{
    public Task<List<ChatInfo>?> GetUserChatsAsync(Guid userId, CancellationToken cancellationToken = default) =>
        Task.FromResult<List<ChatInfo>?>(null);

    public Task SetUserChatsAsync(Guid userId, List<ChatInfo> chats, CancellationToken cancellationToken = default) =>
        Task.CompletedTask;

    public Task<List<CachedUserServerItem>?> GetUserServersAsync(Guid userId, CancellationToken cancellationToken = default) =>
        Task.FromResult<List<CachedUserServerItem>?>(null);

    public Task SetUserServersAsync(Guid userId, List<CachedUserServerItem> servers, CancellationToken cancellationToken = default) =>
        Task.CompletedTask;

    public Task InvalidateUserChatsAsync(Guid userId, CancellationToken cancellationToken = default) =>
        Task.CompletedTask;

    public Task InvalidateUserChatsAsync(IEnumerable<Guid> userIds, CancellationToken cancellationToken = default) =>
        Task.CompletedTask;

    public Task InvalidateUserServersAsync(Guid userId, CancellationToken cancellationToken = default) =>
        Task.CompletedTask;

    public Task InvalidateChatListForChatAsync(Guid chatId, CancellationToken cancellationToken = default) =>
        Task.CompletedTask;
}
