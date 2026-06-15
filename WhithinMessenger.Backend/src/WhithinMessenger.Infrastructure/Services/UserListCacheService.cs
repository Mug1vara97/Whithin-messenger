using System.Text.Json;
using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using WhithinMessenger.Application.Models;
using WhithinMessenger.Application.Options;
using WhithinMessenger.Application.Services;
using WhithinMessenger.Domain.Interfaces;

namespace WhithinMessenger.Infrastructure.Services;

internal sealed class UserListCacheService : IUserListCacheService
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true,
    };

    private readonly IDistributedCache _cache;
    private readonly IChatRepository _chatRepository;
    private readonly ILogger<UserListCacheService> _logger;
    private readonly TimeSpan _ttl;

    public UserListCacheService(
        IDistributedCache cache,
        IChatRepository chatRepository,
        IOptions<RedisCacheSettings> options,
        ILogger<UserListCacheService> logger)
    {
        _cache = cache;
        _chatRepository = chatRepository;
        _logger = logger;
        var ttlSeconds = Math.Clamp(options.Value.UserListTtlSeconds, 5, 300);
        _ttl = TimeSpan.FromSeconds(ttlSeconds);
    }

    public async Task<List<ChatInfo>?> GetUserChatsAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        return await GetAsync<List<ChatInfo>>(UserChatsKey(userId), cancellationToken);
    }

    public Task SetUserChatsAsync(Guid userId, List<ChatInfo> chats, CancellationToken cancellationToken = default) =>
        SetAsync(UserChatsKey(userId), chats, cancellationToken);

    public async Task<List<CachedUserServerItem>?> GetUserServersAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        return await GetAsync<List<CachedUserServerItem>>(UserServersKey(userId), cancellationToken);
    }

    public Task SetUserServersAsync(Guid userId, List<CachedUserServerItem> servers, CancellationToken cancellationToken = default) =>
        SetAsync(UserServersKey(userId), servers, cancellationToken);

    public Task InvalidateUserChatsAsync(Guid userId, CancellationToken cancellationToken = default) =>
        RemoveSafeAsync(UserChatsKey(userId), cancellationToken);

    public async Task InvalidateUserChatsAsync(IEnumerable<Guid> userIds, CancellationToken cancellationToken = default)
    {
        foreach (var userId in userIds.Distinct())
        {
            if (userId == Guid.Empty)
            {
                continue;
            }

            await InvalidateUserChatsAsync(userId, cancellationToken);
        }
    }

    public Task InvalidateUserServersAsync(Guid userId, CancellationToken cancellationToken = default) =>
        RemoveSafeAsync(UserServersKey(userId), cancellationToken);

    public async Task InvalidateChatListForChatAsync(Guid chatId, CancellationToken cancellationToken = default)
    {
        if (chatId == Guid.Empty)
        {
            return;
        }

        try
        {
            var memberIds = await _chatRepository.GetChatMembersAsync(chatId, cancellationToken);
            await InvalidateUserChatsAsync(memberIds, cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to invalidate chat list cache for chat {ChatId}", chatId);
        }
    }

    private async Task<T?> GetAsync<T>(string key, CancellationToken cancellationToken)
    {
        try
        {
            var payload = await _cache.GetStringAsync(key, cancellationToken);
            if (string.IsNullOrWhiteSpace(payload))
            {
                return default;
            }

            return JsonSerializer.Deserialize<T>(payload, JsonOptions);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Redis cache read failed for key {CacheKey}", key);
            return default;
        }
    }

    private async Task SetAsync<T>(string key, T value, CancellationToken cancellationToken)
    {
        try
        {
            var payload = JsonSerializer.Serialize(value, JsonOptions);
            await _cache.SetStringAsync(
                key,
                payload,
                new DistributedCacheEntryOptions { AbsoluteExpirationRelativeToNow = _ttl },
                cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Redis cache write failed for key {CacheKey}", key);
        }
    }

    private async Task RemoveSafeAsync(string key, CancellationToken cancellationToken)
    {
        try
        {
            await _cache.RemoveAsync(key, cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Redis cache invalidate failed for key {CacheKey}", key);
        }
    }

    private static string UserChatsKey(Guid userId) => $"user-chats:{userId:D}";

    private static string UserServersKey(Guid userId) => $"user-servers:{userId:D}";
}
