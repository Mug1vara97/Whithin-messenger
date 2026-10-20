namespace WhithinMessenger.Api.Services;

public interface IChatMessagePublisher
{
    Task PublishTextMessageAsync(
        Guid chatId,
        Guid senderUserId,
        Guid messageId,
        string content,
        int encryptionVersion = 0,
        Guid? repliedToMessageId = null,
        Guid? forwardedFromMessageId = null,
        CancellationToken cancellationToken = default);
}
