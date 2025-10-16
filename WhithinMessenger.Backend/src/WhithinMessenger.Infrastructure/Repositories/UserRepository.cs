using Microsoft.EntityFrameworkCore;
using WhithinMessenger.Domain.Interfaces;
using WhithinMessenger.Domain.Models;
using WhithinMessenger.Application.DTOs;
using WhithinMessenger.Application.Interfaces;
using WhithinMessenger.Infrastructure.Database;

namespace WhithinMessenger.Infrastructure.Repositories
{
    public class UserRepository : IUserRepository, IUserRepositoryExtensions
    {
        private readonly WithinDbContext _context;

        public UserRepository(WithinDbContext context)
        {
            _context = context;
        }

        public async Task<ApplicationUser?> GetByIdAsync(Guid userId, CancellationToken cancellationToken = default)
        {
            return await _context.Users
                .Include(u => u.UserProfile)
                .FirstOrDefaultAsync(u => u.Id == userId, cancellationToken);
        }

        public async Task<ApplicationUser?> GetByUsernameAsync(string username, CancellationToken cancellationToken = default)
        {
            return await _context.Users
                .Include(u => u.UserProfile)
                .FirstOrDefaultAsync(u => u.UserName == username, cancellationToken);
        }

        public async Task<List<UserSearchInfo>> SearchUsersAsync(Guid currentUserId, string searchTerm, CancellationToken cancellationToken = default)
        {
            var normalizedName = searchTerm.Trim().ToLower();

            // Получаем ID друзей текущего пользователя
            var friendIds = await _context.Friendships
                .Where(f => (f.RequesterId == currentUserId || f.AddresseeId == currentUserId) && f.Status == FriendshipStatus.Accepted)
                .Select(f => f.RequesterId == currentUserId ? f.AddresseeId : f.RequesterId)
                .ToListAsync(cancellationToken);

            var existingChatUserIds = await _context.Members
                .Where(m => m.UserId == currentUserId)
                .Select(m => m.ChatId)
                .SelectMany(chatId => _context.Members
                    .Where(m => m.ChatId == chatId && m.UserId != currentUserId)
                    .Select(m => m.UserId))
                .Distinct()
                .ToListAsync(cancellationToken);

            var users = await _context.Users
                .Where(u => u.Id != currentUserId)
                .Where(u => friendIds.Contains(u.Id)) // Фильтруем только друзей
                .Where(u =>
                    u.UserName.ToLower().Contains(normalizedName) ||
                    u.UserName.ToLower().Replace(" ", "").Contains(normalizedName.Replace(" ", "")) ||
                    u.UserName.ToLower().StartsWith(normalizedName) ||
                    u.UserName.ToLower().EndsWith(normalizedName))
                .Select(u => new UserSearchInfo
                {
                    UserId = u.Id,
                    Username = u.UserName,
                    AvatarUrl = u.UserProfile.Avatar,
                    AvatarColor = u.UserProfile.AvatarColor,
                    UserStatus = u.Status.ToString().ToLower(),
                    LastSeen = u.LastSeen,
                    HasExistingChat = existingChatUserIds.Contains(u.Id)
                })
                .OrderByDescending(u => u.HasExistingChat)
                .ThenBy(u => u.Username)
                .Take(20)
                .ToListAsync(cancellationToken);

            return users;
        }

        public async Task<List<UserSearchInfo>> GetAllUsersAsync(Guid currentUserId, CancellationToken cancellationToken = default)
        {
            var existingChatUserIds = await _context.Members
                .Where(m => m.UserId == currentUserId)
                .Select(m => m.ChatId)
                .SelectMany(chatId => _context.Members
                    .Where(m => m.ChatId == chatId && m.UserId != currentUserId)
                    .Select(m => m.UserId))
                .Distinct()
                .ToListAsync(cancellationToken);

            var users = await _context.Users
                .Where(u => u.Id != currentUserId)
                .Select(u => new UserSearchInfo
                {
                    UserId = u.Id,
                    Username = u.UserName,
                    AvatarUrl = u.UserProfile.Avatar,
                    AvatarColor = u.UserProfile.AvatarColor,
                    UserStatus = u.Status.ToString().ToLower(),
                    LastSeen = u.LastSeen,
                    HasExistingChat = existingChatUserIds.Contains(u.Id)
                })
                .OrderByDescending(u => u.HasExistingChat)
                .ThenBy(u => u.Username)
                .Take(50) // Ограничиваем количество для производительности
                .ToListAsync(cancellationToken);

            return users;
        }

        public async Task<List<UserSearchInfo>> GetUsersWithExistingChatsAsync(Guid currentUserId, CancellationToken cancellationToken = default)
        {
            Console.WriteLine($"GetUsersWithExistingChatsAsync: Getting users for {currentUserId}");
            
            // Получаем ID друзей текущего пользователя
            var friendIds = await _context.Friendships
                .Where(f => (f.RequesterId == currentUserId || f.AddresseeId == currentUserId) && f.Status == FriendshipStatus.Accepted)
                .Select(f => f.RequesterId == currentUserId ? f.AddresseeId : f.RequesterId)
                .ToListAsync(cancellationToken);

            // Получаем ID пользователей, с которыми у текущего пользователя есть чаты
            var existingChatUserIds = await _context.Members
                .Where(m => m.UserId == currentUserId)
                .Select(m => m.ChatId)
                .SelectMany(chatId => _context.Members
                    .Where(m => m.ChatId == chatId && m.UserId != currentUserId)
                    .Select(m => m.UserId))
                .Distinct()
                .ToListAsync(cancellationToken);

            Console.WriteLine($"GetUsersWithExistingChatsAsync: Found {existingChatUserIds.Count} user IDs with existing chats");

            if (!existingChatUserIds.Any())
            {
                Console.WriteLine("GetUsersWithExistingChatsAsync: No users with existing chats found");
                return new List<UserSearchInfo>();
            }

            var users = await _context.Users
                .Where(u => existingChatUserIds.Contains(u.Id))
                .Where(u => friendIds.Contains(u.Id)) // Фильтруем только друзей
                .Select(u => new UserSearchInfo
                {
                    UserId = u.Id,
                    Username = u.UserName,
                    AvatarUrl = u.UserProfile.Avatar,
                    AvatarColor = u.UserProfile.AvatarColor,
                    UserStatus = u.Status.ToString().ToLower(),
                    LastSeen = u.LastSeen,
                    HasExistingChat = true // Все эти пользователи имеют существующие чаты
                })
                .OrderBy(u => u.Username)
                .ToListAsync(cancellationToken);

            return users;
        }
    }
}
