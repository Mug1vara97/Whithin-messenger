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

            var friendships = await _context.Friendships
                .Where(f => f.RequesterId == currentUserId || f.AddresseeId == currentUserId)
                .ToListAsync(cancellationToken);

            var friendIds = friendships
                .Where(f => f.Status == FriendshipStatus.Accepted)
                .Select(f => f.RequesterId == currentUserId ? f.AddresseeId : f.RequesterId)
                .ToHashSet();

            var friendshipStatusMap = friendships
                .ToDictionary(
                    f => f.RequesterId == currentUserId ? f.AddresseeId : f.RequesterId,
                    f => f.Status.ToString()
                );

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
                    HasExistingChat = existingChatUserIds.Contains(u.Id),
                    IsFriend = friendIds.Contains(u.Id),
                    FriendshipStatus = friendshipStatusMap.ContainsKey(u.Id) ? friendshipStatusMap[u.Id] : null
                })
                .OrderByDescending(u => u.HasExistingChat)
                .ThenBy(u => u.Username)
                .Take(50)
                .ToListAsync(cancellationToken);

            return users;
        }

        public async Task<List<UserSearchInfo>> GetAllUsersAsync(Guid currentUserId, CancellationToken cancellationToken = default)
        {
            var friendships = await _context.Friendships
                .Where(f => f.RequesterId == currentUserId || f.AddresseeId == currentUserId)
                .ToListAsync(cancellationToken);

            var friendIds = friendships
                .Where(f => f.Status == FriendshipStatus.Accepted)
                .Select(f => f.RequesterId == currentUserId ? f.AddresseeId : f.RequesterId)
                .ToHashSet();

            var friendshipStatusMap = friendships
                .ToDictionary(
                    f => f.RequesterId == currentUserId ? f.AddresseeId : f.RequesterId,
                    f => f.Status.ToString()
                );

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
                    HasExistingChat = existingChatUserIds.Contains(u.Id),
                    IsFriend = friendIds.Contains(u.Id),
                    FriendshipStatus = friendshipStatusMap.ContainsKey(u.Id) ? friendshipStatusMap[u.Id] : null
                })
                .OrderByDescending(u => u.HasExistingChat)
                .ThenBy(u => u.Username)
                .Take(50)
                .ToListAsync(cancellationToken);

            return users;
        }

        public async Task<List<UserSearchInfo>> GetUsersWithExistingChatsAsync(Guid currentUserId, CancellationToken cancellationToken = default)
        {
            Console.WriteLine($"GetUsersWithExistingChatsAsync: Getting users for {currentUserId}");
            
            var friendships = await _context.Friendships
                .Where(f => f.RequesterId == currentUserId || f.AddresseeId == currentUserId)
                .ToListAsync(cancellationToken);

            var friendIds = friendships
                .Where(f => f.Status == FriendshipStatus.Accepted)
                .Select(f => f.RequesterId == currentUserId ? f.AddresseeId : f.RequesterId)
                .ToHashSet();

            var friendshipStatusMap = friendships
                .ToDictionary(
                    f => f.RequesterId == currentUserId ? f.AddresseeId : f.RequesterId,
                    f => f.Status.ToString()
                );

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
                .Select(u => new UserSearchInfo
                {
                    UserId = u.Id,
                    Username = u.UserName,
                    AvatarUrl = u.UserProfile.Avatar,
                    AvatarColor = u.UserProfile.AvatarColor,
                    UserStatus = u.Status.ToString().ToLower(),
                    LastSeen = u.LastSeen,
                    HasExistingChat = true,
                    IsFriend = friendIds.Contains(u.Id),
                    FriendshipStatus = friendshipStatusMap.ContainsKey(u.Id) ? friendshipStatusMap[u.Id] : null
                })
                .OrderBy(u => u.Username)
                .ToListAsync(cancellationToken);

            return users;
        }
    }
}
