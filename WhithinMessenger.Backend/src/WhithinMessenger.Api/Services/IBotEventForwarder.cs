namespace WhithinMessenger.Api.Services;

public interface IBotEventForwarder
{
    Task ForwardMessageCreatedAsync(
        Guid chatId,
        Guid messageId,
        Guid senderId,
        string content,
        string? senderUsername,
        Guid? serverId = null,
        CancellationToken cancellationToken = default);

    Task ForwardMessageUpdatedAsync(
        Guid chatId,
        Guid messageId,
        Guid senderId,
        string content,
        CancellationToken cancellationToken = default);

    Task ForwardMessageDeletedAsync(
        Guid chatId,
        Guid messageId,
        CancellationToken cancellationToken = default);

    Task ForwardMemberJoinedAsync(
        Guid serverId,
        string? serverName,
        Guid userId,
        string? username,
        CancellationToken cancellationToken = default);
}
