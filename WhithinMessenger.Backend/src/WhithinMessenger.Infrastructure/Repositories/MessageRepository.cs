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
                .Include(m => m.ForwardedFromChat)
                .Include(m => m.ForwardedByUser)
                .Include(m => m.RepliedToMessage)
                    .ThenInclude(m => m.User)
                .Include(m => m.MediaFiles)
                .FirstOrDefaultAsync(m => m.Id == messageId, cancellationToken);
        }

        public async Task<List<Message>> GetByChatIdAsync(Guid chatId, CancellationToken cancellationToken = default)
        {
            return await _context.Messages
                .Where(m => m.ChatId == chatId)
                .Include(m => m.User)
                    .ThenInclude(u => u.UserProfile)
                .Include(m => m.ForwardedFromMessage)
                    .ThenInclude(m => m.User)
                .Include(m => m.ForwardedFromChat)
                .Include(m => m.ForwardedByUser)
                .Include(m => m.RepliedToMessage)
                    .ThenInclude(m => m.User)
                .Include(m => m.MediaFiles)
                .OrderBy(m => m.CreatedAt)
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
