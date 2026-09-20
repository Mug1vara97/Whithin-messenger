using WhithinMessenger.Domain.Models;

namespace WhithinMessenger.Application.Services;

public interface INewsChannelFeedSyncService
{
    Task PublishFromMessageAsync(Guid messageId, CancellationToken cancellationToken = default);
}
