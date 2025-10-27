using Microsoft.EntityFrameworkCore;
using WhithinMessenger.Domain.Interfaces;
using WhithinMessenger.Domain.Models;
using WhithinMessenger.Application.DTOs;
using WhithinMessenger.Application.Interfaces;
using WhithinMessenger.Infrastructure.Database;

namespace WhithinMessenger.Infrastructure.Repositories
{
    public class ChatRepository : IChatRepository, IChatRepositoryExtensions
    {
        private readonly WithinDbContext _context;

        public ChatRepository(WithinDbContext context)
        {
            _context = context;
        }

        public async Task<List<ChatInfo>> GetUserChatsAsync(Guid userId, CancellationToken cancellationToken = default)
        {
            var oneOnOneChats = await _context.Members
                .Where(m => m.UserId == userId)
                .Select(m => m.Chat)
                .Where(c => c.Type.TypeName == "Private")
                .Select(c => new ChatInfo
                {
                    ChatId = c.Id,
                    Username = _context.Members
                        .Where(m => m.ChatId == c.Id && m.UserId != userId)
                        .Select(m => m.User.UserName)
                        .FirstOrDefault() ?? string.Empty,
                    UserId = _context.Members
                        .Where(m => m.ChatId == c.Id && m.UserId != userId)
                        .Select(m => m.UserId)
                        .FirstOrDefault(),
                    AvatarUrl = _context.Members
                        .Where(m => m.ChatId == c.Id && m.UserId != userId)
                        .Select(m => m.User.UserProfile.Avatar)
                        .FirstOrDefault(),
                    AvatarColor = _context.Members
                        .Where(m => m.ChatId == c.Id && m.UserId != userId)
                        .Select(m => m.User.UserProfile.AvatarColor)
                        .FirstOrDefault(),
                    UserStatus = _context.Members
                        .Where(m => m.ChatId == c.Id && m.UserId != userId)
                        .Select(m => m.User.Status.ToString().ToLower())
                        .FirstOrDefault() ?? "offline",
                    LastSeen = _context.Members
                        .Where(m => m.ChatId == c.Id && m.UserId != userId)
                        .Select(m => m.User.LastSeen)
                        .FirstOrDefault(),
                    IsGroupChat = false,
                    LastMessage = _context.Messages
                        .Where(m => m.ChatId == c.Id)
                        .OrderByDescending(m => m.CreatedAt)
                        .Select(m => m.Content)
                        .FirstOrDefault(),
                    LastMessageTime = _context.Messages
                        .Where(m => m.ChatId == c.Id)
                        .OrderByDescending(m => m.CreatedAt)
                        .Select(m => m.CreatedAt)
                        .FirstOrDefault()
                })
                .ToListAsync(cancellationToken);

            var groupChats = await _context.Members
                .Where(m => m.UserId == userId)
                .Select(m => m.Chat)
                .Where(c => c.Type.TypeName == "Group")
                .Select(c => new ChatInfo
                {
                    ChatId = c.Id,
                    Username = c.Name ?? string.Empty,
                    UserId = userId,
                    AvatarUrl = c.Avatar,
                    AvatarColor = c.AvatarColor,
                    IsGroupChat = true,
                    LastMessage = _context.Messages
                        .Where(m => m.ChatId == c.Id)
                        .OrderByDescending(m => m.CreatedAt)
                        .Select(m => m.Content)
                        .FirstOrDefault(),
                    LastMessageTime = _context.Messages
                        .Where(m => m.ChatId == c.Id)
                        .OrderByDescending(m => m.CreatedAt)
                        .Select(m => m.CreatedAt)
                        .FirstOrDefault()
                })
                .ToListAsync(cancellationToken);

            return oneOnOneChats
                .Concat(groupChats)
                .OrderByDescending(c => c.LastMessageTime)
                .ToList();
        }

        public async Task<CreatePrivateChatResult> CreatePrivateChatAsync(Guid userId, Guid targetUserId, CancellationToken cancellationToken = default)
        {
            try
            {
                var user1Exists = await _context.Users.AnyAsync(u => u.Id == userId, cancellationToken);
                var user2Exists = await _context.Users.AnyAsync(u => u.Id == targetUserId, cancellationToken);

                if (!user1Exists || !user2Exists)
                {
                    return new CreatePrivateChatResult
                    {
                        Success = false,
                        ErrorMessage = "Один или оба пользователя не существуют"
                    };
                }

                var existingChat = await _context.Members
                    .Where(m => m.UserId == userId)
                    .Select(m => m.Chat)
                    .Where(c => c.Type.TypeName == "Private")
                    .Where(c => _context.Members.Any(m => m.ChatId == c.Id && m.UserId == targetUserId))
                    .FirstOrDefaultAsync(cancellationToken);

                if (existingChat != null)
                {
                    return new CreatePrivateChatResult
                    {
                        ChatId = existingChat.Id,
                        Exists = true,
                        Success = true
                    };
                }

                var privateChatType = await _context.ChatTypes
                    .Where(ct => ct.TypeName == "Private")
                    .FirstOrDefaultAsync(cancellationToken);

                if (privateChatType == null)
                {
                    return new CreatePrivateChatResult
                    {
                        ChatId = Guid.Empty,
                        Exists = false,
                        Success = false,
                        ErrorMessage = "Private chat type not found"
                    };
                }

                var newChat = new Chat
                {
                    TypeId = privateChatType.Id,
                    IsPrivate = true,
                    CreatedAt = DateTimeOffset.UtcNow
                };

                _context.Chats.Add(newChat);
                await _context.SaveChangesAsync(cancellationToken);

                _context.Members.Add(new Member 
                { 
                    UserId = userId, 
                    ChatId = newChat.Id,
                    Chat = newChat,
                    User = await _context.Users.FindAsync(userId) ?? throw new InvalidOperationException("User not found")
                });
                _context.Members.Add(new Member 
                { 
                    UserId = targetUserId, 
                    ChatId = newChat.Id,
                    Chat = newChat,
                    User = await _context.Users.FindAsync(targetUserId) ?? throw new InvalidOperationException("User not found")
                });
                await _context.SaveChangesAsync(cancellationToken);

                return new CreatePrivateChatResult
                {
                    ChatId = newChat.Id,
                    Exists = false,
                    Success = true
                };
            }
            catch (Exception ex)
            {
                return new CreatePrivateChatResult
                {
                    Success = false,
                    ErrorMessage = "Произошла ошибка при создании чата: " + ex.Message
                };
            }
        }

        public async Task<Chat?> GetByIdAsync(Guid chatId, CancellationToken cancellationToken = default)
        {
            return await _context.Chats
                .Include(c => c.Type)
                .FirstOrDefaultAsync(c => c.Id == chatId, cancellationToken);
        }

        public async Task<List<Guid>> GetChatMembersAsync(Guid chatId, CancellationToken cancellationToken = default)
        {
            return await _context.Members
                .Where(m => m.ChatId == chatId)
                .Select(m => m.UserId)
                .ToListAsync(cancellationToken);
        }

        public async Task<List<ChatParticipantInfo>> GetChatParticipantsAsync(Guid chatId, CancellationToken cancellationToken = default)
        {
            try
            {
                var participants = await _context.Members
                    .Where(m => m.ChatId == chatId)
                    .Select(m => new ChatParticipantInfo
                    {
                        UserId = m.UserId,
                        Username = m.User.UserName,
                        AvatarUrl = m.User.UserProfile.Avatar,
                        AvatarColor = m.User.UserProfile.AvatarColor,
                        UserStatus = m.User.Status.ToString().ToLower(),
                        LastSeen = m.User.LastSeen
                    })
                    .ToListAsync(cancellationToken);
                
                return participants;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"ChatRepository - Error getting participants: {ex.Message}");
                throw;
            }
        }

        public async Task<List<Chat>> GetByServerIdAsync(Guid serverId, CancellationToken cancellationToken = default)
        {
            return await _context.Chats
                .Where(c => c.ServerId == serverId)
                .Include(c => c.Category)
                .Include(c => c.Members)
                .ToListAsync(cancellationToken);
        }

        public async Task<ChatInfoDto?> GetChatInfoAsync(Guid chatId, Guid userId, CancellationToken cancellationToken = default)
        {
            try
            {
                var chat = await _context.Chats
                    .Include(c => c.Type)
                    .Include(c => c.Members)
                        .ThenInclude(m => m.User)
                            .ThenInclude(u => u.UserProfile)
                    .FirstOrDefaultAsync(c => c.Id == chatId, cancellationToken);

                if (chat == null)
                {
                    return null;
                }

                if (chat.Type.TypeName == "Private")
                {
                    var otherMember = chat.Members.FirstOrDefault(m => m.UserId != userId);
                    if (otherMember != null)
                    {
                        return new ChatInfoDto
                        {
                            ChatId = chat.Id,
                            Name = otherMember.User.UserName ?? "Пользователь",
                            Type = "private",
                            Avatar = otherMember.User.UserProfile?.Avatar,
                            AvatarColor = otherMember.User.UserProfile?.AvatarColor,
                            OtherUserId = otherMember.UserId
                        };
                    }
                }

                return new ChatInfoDto
                {
                    ChatId = chat.Id,
                    Name = chat.Name ?? "Групповой чат",
                    Type = "group",
                    Avatar = null,
                    AvatarColor = null,
                    ChatAvatar = chat.Avatar,
                    ChatAvatarColor = chat.AvatarColor,
                    OtherUserId = null
                };
            }
            catch (Exception ex)
            {
                Console.WriteLine($"ChatRepository - Error getting chat info: {ex.Message}");
                return null;
            }
        }

        public async Task CreateAsync(Chat chat, CancellationToken cancellationToken = default)
        {
            _context.Chats.Add(chat);
            await _context.SaveChangesAsync(cancellationToken);
        }

        public async Task UpdateAsync(Chat chat, CancellationToken cancellationToken = default)
        {
            _context.Chats.Update(chat);
            await _context.SaveChangesAsync(cancellationToken);
        }

        public async Task DeleteAsync(Guid chatId, CancellationToken cancellationToken = default)
        {
            var chat = await _context.Chats.FindAsync(chatId);
            if (chat != null)
            {
                _context.Chats.Remove(chat);
                await _context.SaveChangesAsync(cancellationToken);
            }
        }

        public async Task DeleteAllByServerIdAsync(Guid serverId, CancellationToken cancellationToken = default)
        {
            var chats = await _context.Chats
                .Where(c => c.ServerId == serverId)
                .ToListAsync(cancellationToken);

            if (chats.Any())
            {
                _context.Chats.RemoveRange(chats);
                await _context.SaveChangesAsync(cancellationToken);
            }
        }

        public async Task<ChatType?> GetChatTypeByNameAsync(string typeName, CancellationToken cancellationToken = default)
        {
            return await _context.ChatTypes
                .FirstOrDefaultAsync(ct => ct.TypeName == typeName, cancellationToken);
        }

        public async Task<List<AvailableUserInfo>> GetAvailableUsersForGroupAsync(Guid currentUserId, Guid groupChatId, CancellationToken cancellationToken = default)
        {
            try
            {
                var usersWithPrivateChats = await _context.Members
                    .Where(m => m.UserId == currentUserId)
                    .Include(m => m.Chat)
                    .ThenInclude(c => c.Members)
                    .ThenInclude(m => m.User)
                    .SelectMany(m => m.Chat.Members)
                    .Where(m => m.UserId != currentUserId && m.User != null)
                    .Select(m => m.User)
                    .Distinct()
                    .ToListAsync(cancellationToken);

                var groupMembers = await _context.Members
                    .Where(m => m.ChatId == groupChatId)
                    .Select(m => m.UserId)
                    .ToListAsync(cancellationToken);
                
                var availableUsers = usersWithPrivateChats
                    .Where(u => u != null && !groupMembers.Contains(u.Id))
                    .Select(u => new AvailableUserInfo
                    {
                        UserId = u.Id,
                        Username = u.UserName ?? string.Empty,
                        AvatarUrl = u.UserProfile?.Avatar,
                        AvatarColor = u.UserProfile?.AvatarColor,
                        UserStatus = u.Status.ToString().ToLower(),
                        LastSeen = u.LastSeen,
                        HasExistingChat = true
                    })
                    .ToList();

                return availableUsers;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"ChatRepository - Error getting available users: {ex.Message}");
                throw;
            }
        }

        public async Task<bool> AddUserToGroupAsync(Guid groupChatId, Guid userId, CancellationToken cancellationToken = default)
        {
            try
            {
                var chat = await _context.Chats
                    .Include(c => c.Type)
                    .FirstOrDefaultAsync(c => c.Id == groupChatId, cancellationToken);

                if (chat == null || chat.Type.TypeName != "Group")
                {
                    return false;
                }

                var existingMember = await _context.Members
                    .FirstOrDefaultAsync(m => m.ChatId == groupChatId && m.UserId == userId, cancellationToken);

                if (existingMember != null)
                {
                    return false; // User already in group
                }

                var member = new Member
                {
                    Id = Guid.NewGuid(),
                    ChatId = groupChatId,
                    UserId = userId,
                    JoinedAt = DateTimeOffset.UtcNow,
                    Chat = chat,
                    User = null!
                };

                _context.Members.Add(member);
                await _context.SaveChangesAsync(cancellationToken);

                return true;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"ChatRepository - Error adding user to group: {ex.Message}");
                throw;
            }
        }

        public async Task<bool> IsUserParticipantAsync(Guid chatId, Guid userId, CancellationToken cancellationToken = default)
        {
            try
            {
                return await _context.Members
                    .AnyAsync(m => m.ChatId == chatId && m.UserId == userId, cancellationToken);
            }
            catch (Exception ex)
            {
                Console.WriteLine($ChatRepository - Error checking user participation: {ex.Message}");
                return false;
            }
        }
    }
}
