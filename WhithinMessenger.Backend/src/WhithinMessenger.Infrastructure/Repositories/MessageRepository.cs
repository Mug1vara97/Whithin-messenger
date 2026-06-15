using Microsoft.EntityFrameworkCore;
using WhithinMessenger.Domain.Interfaces;
using WhithinMessenger.Domain.Models;
using WhithinMessenger.Infrastructure.Database;

namespace WhithinMessenger.Infrastructure.Repositories
{
    public class MessageRepository : IMessageRepository
    {
        private readonly WithinDbContext _context;

        public MessageRepository(WithinDbContext context)
        {
            _context = context;
        }

        public async Task<Message?> GetByIdAsync(Guid messageId, CancellationToken cancellationToken = default)
        {
            return await _context.Messages
                .Include(m => m.User)
                    .ThenInclude(u => u.UserProfile)
                .Include(m => m.ForwardedFromMessage)
                    .ThenInclude(m => m.User)
                .Include(m => m.ForwardedFromMessage)
                    .ThenInclude(m => m.MediaFiles)
                .Include(m => m.ForwardedFromMessage)
                    .ThenInclude(m => m.Sticker)
                .Include(m => m.ForwardedFromChat)
                .Include(m => m.ForwardedByUser)
                .Include(m => m.RepliedToMessage)
                    .ThenInclude(m => m.User)
                .Include(m => m.MediaFiles)
                .Include(m => m.Sticker)
                .Include(m => m.Poll)
                    .ThenInclude(p => p!.Options.OrderBy(o => o.SortOrder))
                        .ThenInclude(o => o.Votes)
                            .ThenInclude(v => v.User)
                                .ThenInclude(u => u.UserProfile)
                .FirstOrDefaultAsync(m => m.Id == messageId, cancellationToken);
        }

        public async Task<List<Message>> GetByChatIdAsync(Guid chatId, CancellationToken cancellationToken = default)
        {
            return await ApplyMessageIncludes(_context.Messages.AsNoTracking().Where(m => m.ChatId == chatId))
                .OrderBy(m => m.CreatedAt)
                .ToListAsync(cancellationToken);
        }

        public async Task<List<Message>> GetByChatIdPageAsync(
            Guid chatId,
            int limit,
            Guid? beforeMessageId = null,
            CancellationToken cancellationToken = default)
        {
            var query = _context.Messages.AsNoTracking().Where(m => m.ChatId == chatId);

            if (beforeMessageId.HasValue)
            {
                var cursor = await _context.Messages
                    .AsNoTracking()
                    .Where(m => m.Id == beforeMessageId.Value && m.ChatId == chatId)
                    .Select(m => new { m.CreatedAt, m.Id })
                    .FirstOrDefaultAsync(cancellationToken);

                if (cursor != null)
                {
                    query = query.Where(m =>
                        m.CreatedAt < cursor.CreatedAt ||
                        (m.CreatedAt == cursor.CreatedAt && m.Id < cursor.Id));
                }
            }

            var page = await ApplyMessageIncludes(query)
                .OrderByDescending(m => m.CreatedAt)
                .ThenByDescending(m => m.Id)
                .Take(limit)
                .ToListAsync(cancellationToken);

            page.Reverse();
            return page;
        }

        public async Task<(List<Message> Messages, bool HasMoreOlder)> GetByChatIdPageWithHasMoreAsync(
            Guid chatId,
            int limit,
            Guid? beforeMessageId = null,
            CancellationToken cancellationToken = default)
        {
            if (limit <= 0)
            {
                var all = await GetByChatIdAsync(chatId, cancellationToken);
                return (all, false);
            }

            var query = _context.Messages.AsNoTracking().Where(m => m.ChatId == chatId);

            if (beforeMessageId.HasValue)
            {
                var cursor = await _context.Messages
                    .AsNoTracking()
                    .Where(m => m.Id == beforeMessageId.Value && m.ChatId == chatId)
                    .Select(m => new { m.CreatedAt, m.Id })
                    .FirstOrDefaultAsync(cancellationToken);

                if (cursor != null)
                {
                    query = query.Where(m =>
                        m.CreatedAt < cursor.CreatedAt ||
                        (m.CreatedAt == cursor.CreatedAt && m.Id < cursor.Id));
                }
            }

            var page = await ApplyMessageIncludes(query)
                .OrderByDescending(m => m.CreatedAt)
                .ThenByDescending(m => m.Id)
                .Take(limit + 1)
                .ToListAsync(cancellationToken);

            var hasMoreOlder = page.Count > limit;
            if (hasMoreOlder)
            {
                page.RemoveAt(page.Count - 1);
            }

            page.Reverse();
            return (page, hasMoreOlder);
        }

        public async Task<bool> HasOlderMessagesAsync(
            Guid chatId,
            Guid messageId,
            CancellationToken cancellationToken = default)
        {
            var cursor = await _context.Messages
                .Where(m => m.Id == messageId && m.ChatId == chatId)
                .Select(m => new { m.CreatedAt, m.Id })
                .FirstOrDefaultAsync(cancellationToken);

            if (cursor == null)
            {
                return false;
            }

            return await _context.Messages.AnyAsync(
                m => m.ChatId == chatId &&
                     (m.CreatedAt < cursor.CreatedAt ||
                      (m.CreatedAt == cursor.CreatedAt && m.Id < cursor.Id)),
                cancellationToken);
        }

        private static IQueryable<Message> ApplyMessageIncludes(IQueryable<Message> query) =>
            query
                .AsSplitQuery()
                .Include(m => m.User)
                    .ThenInclude(u => u.UserProfile)
                .Include(m => m.ForwardedFromMessage)
                    .ThenInclude(m => m.User)
                .Include(m => m.ForwardedFromMessage)
                    .ThenInclude(m => m.MediaFiles)
                .Include(m => m.ForwardedFromMessage)
                    .ThenInclude(m => m.Sticker)
                .Include(m => m.ForwardedFromChat)
                .Include(m => m.ForwardedByUser)
                .Include(m => m.RepliedToMessage)
                    .ThenInclude(m => m.User)
                .Include(m => m.MediaFiles)
                .Include(m => m.Sticker)
                .Include(m => m.Poll)
                    .ThenInclude(p => p!.Options.OrderBy(o => o.SortOrder))
                        .ThenInclude(o => o.Votes)
                            .ThenInclude(v => v.User)
                                .ThenInclude(u => u.UserProfile);

        public async Task<List<Message>> GetPinnedByChatIdAsync(Guid chatId, CancellationToken cancellationToken = default)
        {
            return await ApplyMessageIncludes(_context.Messages.Where(m => m.ChatId == chatId && m.IsPinned))
                .OrderByDescending(m => m.PinnedAt)
                .ToListAsync(cancellationToken);
        }

        public async Task<Message> AddAsync(Message message, CancellationToken cancellationToken = default)
        {
            _context.Messages.Add(message);
            await _context.SaveChangesAsync(cancellationToken);
            return message;
        }

        public async Task<Message> UpdateAsync(Message message, CancellationToken cancellationToken = default)
        {
            _context.Messages.Update(message);
            await _context.SaveChangesAsync(cancellationToken);
            return message;
        }

        public async Task DeleteAsync(Guid messageId, CancellationToken cancellationToken = default)
        {
            var message = await _context.Messages.FindAsync(messageId);
            if (message != null)
            {
                _context.Messages.Remove(message);
                await _context.SaveChangesAsync(cancellationToken);
            }
        }

        public async Task<int> GetUnreadCountByChatAsync(Guid chatId, Guid userId, CancellationToken cancellationToken = default)
        {
            return await _context.Messages
                .Where(m => m.ChatId == chatId && m.UserId != userId)
                .Where(m => !_context.MessageReads.Any(mr => mr.MessageId == m.Id && mr.UserId == userId))
                .CountAsync(cancellationToken);
        }

        public async Task<List<MarkedMessageReadReceipt>> MarkChatAsReadAsync(Guid chatId, Guid userId, CancellationToken cancellationToken = default)
        {
            var unreadMessages = await _context.Messages
                .Where(m => m.ChatId == chatId && m.UserId != userId)
                .Where(m => !_context.MessageReads.Any(mr => mr.MessageId == m.Id && mr.UserId == userId))
                .Select(m => new { m.Id, m.UserId })
                .ToListAsync(cancellationToken);

            if (unreadMessages.Count == 0)
            {
                return [];
            }

            var now = DateTimeOffset.UtcNow;
            var readRows = unreadMessages.Select(message => new MessageRead
            {
                Id = Guid.NewGuid(),
                MessageId = message.Id,
                UserId = userId,
                ReadAt = now,
                Message = null!,
                User = null!
            });

            var unreadMessageIds = unreadMessages.Select(message => message.Id).ToList();
            var alreadyDeliveredIds = await _context.MessageDeliveries
                .AsNoTracking()
                .Where(md => unreadMessageIds.Contains(md.MessageId) && md.UserId == userId)
                .Select(md => md.MessageId)
                .ToListAsync(cancellationToken);

            var deliveryRows = unreadMessages
                .Where(message => !alreadyDeliveredIds.Contains(message.Id))
                .Select(message => new MessageDelivery
                {
                    Id = Guid.NewGuid(),
                    MessageId = message.Id,
                    UserId = userId,
                    DeliveredAt = now,
                    Message = null!,
                    User = null!
                })
                .ToList();

            await _context.MessageReads.AddRangeAsync(readRows, cancellationToken);
            if (deliveryRows.Count > 0)
            {
                await _context.MessageDeliveries.AddRangeAsync(deliveryRows, cancellationToken);
            }

            await _context.SaveChangesAsync(cancellationToken);

            return unreadMessages
                .Select(message => new MarkedMessageReadReceipt(message.Id, message.UserId))
                .ToList();
        }

        public async Task<List<MessageDeliveryReceipt>> AcknowledgePendingDeliveriesForUserAsync(
            Guid userId,
            CancellationToken cancellationToken = default)
        {
            var chatIds = await _context.Members
                .AsNoTracking()
                .Where(m => m.UserId == userId)
                .Select(m => m.ChatId)
                .Distinct()
                .ToListAsync(cancellationToken);

            if (chatIds.Count == 0)
            {
                return [];
            }

            var pendingMessages = await _context.Messages
                .AsNoTracking()
                .Where(m => chatIds.Contains(m.ChatId) && m.UserId != userId)
                .Where(m => !_context.MessageDeliveries.Any(md => md.MessageId == m.Id && md.UserId == userId))
                .Select(m => new { m.Id, m.ChatId })
                .ToListAsync(cancellationToken);

            if (pendingMessages.Count == 0)
            {
                return [];
            }

            var now = DateTimeOffset.UtcNow;
            var deliveries = pendingMessages.Select(m => new MessageDelivery
            {
                Id = Guid.NewGuid(),
                MessageId = m.Id,
                UserId = userId,
                DeliveredAt = now,
                Message = null!,
                User = null!
            }).ToList();

            await _context.MessageDeliveries.AddRangeAsync(deliveries, cancellationToken);
            await _context.SaveChangesAsync(cancellationToken);

            return pendingMessages
                .Select(m => new MessageDeliveryReceipt(m.ChatId, m.Id))
                .ToList();
        }

        public async Task<bool> MarkMessageDeliveredAsync(Guid messageId, Guid userId, CancellationToken cancellationToken = default)
        {
            var message = await _context.Messages
                .AsNoTracking()
                .FirstOrDefaultAsync(m => m.Id == messageId, cancellationToken);

            if (message == null || message.UserId == userId)
            {
                return false;
            }

            var exists = await _context.MessageDeliveries
                .AnyAsync(md => md.MessageId == messageId && md.UserId == userId, cancellationToken);

            if (exists)
            {
                return false;
            }

            await _context.MessageDeliveries.AddAsync(new MessageDelivery
            {
                Id = Guid.NewGuid(),
                MessageId = messageId,
                UserId = userId,
                DeliveredAt = DateTimeOffset.UtcNow,
                Message = null!,
                User = null!
            }, cancellationToken);

            await _context.SaveChangesAsync(cancellationToken);
            return true;
        }

        public async Task<bool> MarkMessageReadAsync(Guid messageId, Guid userId, CancellationToken cancellationToken = default)
        {
            var message = await _context.Messages
                .AsNoTracking()
                .FirstOrDefaultAsync(m => m.Id == messageId, cancellationToken);

            if (message == null || message.UserId == userId)
            {
                return false;
            }

            var exists = await _context.MessageReads
                .AnyAsync(mr => mr.MessageId == messageId && mr.UserId == userId, cancellationToken);

            if (exists)
            {
                return false;
            }

            var now = DateTimeOffset.UtcNow;

            await _context.MessageReads.AddAsync(new MessageRead
            {
                Id = Guid.NewGuid(),
                MessageId = messageId,
                UserId = userId,
                ReadAt = now,
                Message = null!,
                User = null!
            }, cancellationToken);

            var hasDelivery = await _context.MessageDeliveries
                .AnyAsync(md => md.MessageId == messageId && md.UserId == userId, cancellationToken);

            if (!hasDelivery)
            {
                await _context.MessageDeliveries.AddAsync(new MessageDelivery
                {
                    Id = Guid.NewGuid(),
                    MessageId = messageId,
                    UserId = userId,
                    DeliveredAt = now,
                    Message = null!,
                    User = null!
                }, cancellationToken);
            }

            await _context.SaveChangesAsync(cancellationToken);
            return true;
        }

        public async Task<string?> GetMessageStatusAsync(
            Guid messageId,
            Guid senderUserId,
            int recipientCount,
            CancellationToken cancellationToken = default)
        {
            var statuses = await GetMessageStatusesAsync(senderUserId, [messageId], recipientCount, cancellationToken);
            return statuses.GetValueOrDefault(messageId);
        }

        public async Task<Dictionary<Guid, string>> GetMessageStatusesAsync(
            Guid senderUserId,
            IReadOnlyList<Guid> messageIds,
            int recipientCount,
            CancellationToken cancellationToken = default)
        {
            if (messageIds.Count == 0 || recipientCount <= 0)
            {
                return new Dictionary<Guid, string>();
            }

            var ownMessageIds = await _context.Messages
                .AsNoTracking()
                .Where(m => messageIds.Contains(m.Id) && m.UserId == senderUserId)
                .Select(m => m.Id)
                .ToListAsync(cancellationToken);

            if (ownMessageIds.Count == 0)
            {
                return new Dictionary<Guid, string>();
            }

            var readCounts = await _context.MessageReads
                .AsNoTracking()
                .Where(mr => ownMessageIds.Contains(mr.MessageId) && mr.UserId != senderUserId)
                .GroupBy(mr => mr.MessageId)
                .Select(group => new { MessageId = group.Key, Count = group.Count() })
                .ToDictionaryAsync(x => x.MessageId, x => x.Count, cancellationToken);

            var deliveredCounts = await _context.MessageDeliveries
                .AsNoTracking()
                .Where(md => ownMessageIds.Contains(md.MessageId) && md.UserId != senderUserId)
                .GroupBy(md => md.MessageId)
                .Select(group => new { MessageId = group.Key, Count = group.Count() })
                .ToDictionaryAsync(x => x.MessageId, x => x.Count, cancellationToken);

            return ownMessageIds.ToDictionary(
                messageId => messageId,
                messageId => MessageStatusHelper.Resolve(
                    recipientCount,
                    deliveredCounts.GetValueOrDefault(messageId),
                    readCounts.GetValueOrDefault(messageId)));
        }
    }
}
