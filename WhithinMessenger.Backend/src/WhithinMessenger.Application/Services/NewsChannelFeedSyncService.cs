using Microsoft.Extensions.Logging;
using WhithinMessenger.Domain.Interfaces;
using WhithinMessenger.Domain.Models;

namespace WhithinMessenger.Application.Services;

public class NewsChannelFeedSyncService : INewsChannelFeedSyncService
{
    private readonly IMessageRepository _messageRepository;
    private readonly IChatRepository _chatRepository;
    private readonly IFeedPostRepository _feedPostRepository;
    private readonly ILogger<NewsChannelFeedSyncService> _logger;

    public NewsChannelFeedSyncService(
        IMessageRepository messageRepository,
        IChatRepository chatRepository,
        IFeedPostRepository feedPostRepository,
        ILogger<NewsChannelFeedSyncService> logger)
    {
        _messageRepository = messageRepository;
        _chatRepository = chatRepository;
        _feedPostRepository = feedPostRepository;
        _logger = logger;
    }

    public async Task PublishFromMessageAsync(Guid messageId, CancellationToken cancellationToken = default)
    {
        try
        {
            var message = await _messageRepository.GetByIdAsync(messageId, cancellationToken);
            if (message == null)
            {
                return;
            }

            var chat = await _chatRepository.GetByIdAsync(message.ChatId, cancellationToken);
            if (chat == null || !chat.ServerId.HasValue)
            {
                return;
            }

            var isNews =
                chat.TypeId == ChatTypeIds.News
                || string.Equals(chat.Type?.TypeName, ChatTypeNames.News, StringComparison.OrdinalIgnoreCase);
            if (!isNews)
            {
                return;
            }

            var text = (message.Content ?? string.Empty).Trim();
            var mediaFiles = (message.MediaFiles ?? [])
                .Where(m => !m.IsDeleted)
                .OrderBy(m => m.CreatedAt)
                .ToList();

            if (string.IsNullOrWhiteSpace(text) && mediaFiles.Count == 0)
            {
                return;
            }

            // Skip placeholder media-url-only payloads without real attachments.
            if (mediaFiles.Count == 0
                && (text.StartsWith("/uploads/", StringComparison.OrdinalIgnoreCase)
                    || text.StartsWith("http://", StringComparison.OrdinalIgnoreCase)
                    || text.StartsWith("https://", StringComparison.OrdinalIgnoreCase)))
            {
                return;
            }

            var now = DateTimeOffset.UtcNow;
            var post = new FeedPost
            {
                Id = Guid.NewGuid(),
                AuthorUserId = message.UserId,
                Text = text.Length > 2000 ? text[..2000] : text,
                Scope = FeedPostScope.Server,
                ServerId = chat.ServerId.Value,
                CreatedAt = message.CreatedAt == default ? now : message.CreatedAt,
            };

            foreach (var media in mediaFiles.Take(10))
            {
                var path = media.FilePath ?? string.Empty;
                var normalizedPath = path.StartsWith('/') ? path : $"/{path}";
                var thumb = string.IsNullOrWhiteSpace(media.ThumbnailPath)
                    ? null
                    : (media.ThumbnailPath.StartsWith('/')
                        ? media.ThumbnailPath
                        : $"/{media.ThumbnailPath}");

                post.Attachments.Add(new FeedPostAttachment
                {
                    Id = Guid.NewGuid(),
                    FeedPostId = post.Id,
                    FileName = media.FileName,
                    OriginalFileName = media.OriginalFileName,
                    FilePath = normalizedPath,
                    ContentType = string.IsNullOrWhiteSpace(media.ContentType)
                        ? "application/octet-stream"
                        : media.ContentType,
                    FileSize = media.FileSize,
                    ThumbnailPath = thumb,
                    CreatedAt = media.CreatedAt == default ? now : media.CreatedAt,
                });
            }

            await _feedPostRepository.CreateAsync(post, cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to publish news channel message {MessageId} to feed", messageId);
        }
    }
}
