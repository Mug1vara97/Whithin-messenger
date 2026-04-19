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

        public async Task MarkChatAsReadAsync(Guid chatId, Guid userId, CancellationToken cancellationToken = default)
        {
            var unreadMessageIds = await _context.Messages
                .Where(m => m.ChatId == chatId && m.UserId != userId)
                .Where(m => !_context.MessageReads.Any(mr => mr.MessageId == m.Id && mr.UserId == userId))
                .Select(m => m.Id)
                .ToListAsync(cancellationToken);

            if (unreadMessageIds.Count == 0)
            {
                return;
            }

            var now = DateTimeOffset.UtcNow;
            var readRows = unreadMessageIds.Select(messageId => new MessageRead
            {
                Id = Guid.NewGuid(),
                MessageId = messageId,
                UserId = userId,
                ReadAt = now,
                Message = null!,
                User = null!
            });

            await _context.MessageReads.AddRangeAsync(readRows, cancellationToken);
            await _context.SaveChangesAsync(cancellationToken);
        }
    }
}








