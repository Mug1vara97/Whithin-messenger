using Microsoft.EntityFrameworkCore;
using WhithinMessenger.Domain.Interfaces;
using WhithinMessenger.Domain.Models;
using WhithinMessenger.Application.DTOs;
using WhithinMessenger.Application.Interfaces;
using WhithinMessenger.Application.Services;
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
            var savedChat = await EnsureSavedMessagesChatAsync(userId, cancellationToken);

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
                        .FirstOrDefault(),
                    UnreadCount = _context.Messages
                        .Where(m => m.ChatId == c.Id && m.UserId != userId)
                        .Count(m => !_context.MessageReads.Any(mr => mr.MessageId == m.Id && mr.UserId == userId))
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
                        .FirstOrDefault(),
                    UnreadCount = _context.Messages
                        .Where(m => m.ChatId == c.Id && m.UserId != userId)
                        .Count(m => !_context.MessageReads.Any(mr => mr.MessageId == m.Id && mr.UserId == userId))
                })
                .ToListAsync(cancellationToken);

            var chats = oneOnOneChats
                .Concat(groupChats)
                .OrderByDescending(c => c.LastMessageTime)
                .ToList();

            chats.Insert(0, savedChat);

            await ApplyLastMessagePreviewsAsync(chats, cancellationToken);
            return chats;
        }

        public async Task<ChatInfo> EnsureSavedMessagesChatAsync(Guid userId, CancellationToken cancellationToken = default)
        {
            var savedChatType = await _context.ChatTypes
                .FirstOrDefaultAsync(ct => ct.TypeName == ChatTypeNames.Saved, cancellationToken)
                ?? await _context.ChatTypes
                    .FirstOrDefaultAsync(ct => ct.Id == ChatTypeIds.Saved, cancellationToken);

            if (savedChatType == null)
            {
                throw new InvalidOperationException("Saved chat type not found");
            }

            var savedChat = await _context.Members
                .Where(m => m.UserId == userId)
                .Select(m => m.Chat)
                .FirstOrDefaultAsync(c => c.TypeId == savedChatType.Id, cancellationToken);

            if (savedChat == null)
            {
                savedChat = new Chat
                {
                    TypeId = savedChatType.Id,
                    IsPrivate = true,
                    CreatedAt = DateTimeOffset.UtcNow,
                    CreatedByUserId = userId,
                };

                _context.Chats.Add(savedChat);
                await _context.SaveChangesAsync(cancellationToken);

                var user = await _context.Users.FindAsync([userId], cancellationToken)
                    ?? throw new InvalidOperationException("User not found");

                _context.Members.Add(new Member
                {
                    UserId = userId,
                    ChatId = savedChat.Id,
                    Chat = savedChat,
                    User = user,
                });
                await _context.SaveChangesAsync(cancellationToken);
            }

            var profile = await _context.UserProfiles
                .AsNoTracking()
                .FirstOrDefaultAsync(p => p.UserId == userId, cancellationToken);

            var lastMessageTime = await _context.Messages
                .Where(m => m.ChatId == savedChat.Id)
                .OrderByDescending(m => m.CreatedAt)
                .Select(m => (DateTimeOffset?)m.CreatedAt)
                .FirstOrDefaultAsync(cancellationToken) ?? savedChat.CreatedAt;

            return new ChatInfo
            {
                ChatId = savedChat.Id,
                Username = "Избранное",
                UserId = userId,
                AvatarUrl = profile?.Avatar,
                AvatarColor = profile?.AvatarColor,
                UserStatus = "online",
                IsGroupChat = false,
                IsSavedMessages = true,
                LastMessage = await _context.Messages
                    .Where(m => m.ChatId == savedChat.Id)
                    .OrderByDescending(m => m.CreatedAt)
                    .Select(m => m.Content)
                    .FirstOrDefaultAsync(cancellationToken),
                LastMessageTime = lastMessageTime,
                UnreadCount = 0,
            };
        }

        private async Task ApplyLastMessagePreviewsAsync(List<ChatInfo> chats, CancellationToken cancellationToken)
        {
            if (chats.Count == 0)
            {
                return;
            }

            var chatIds = chats.Select(c => c.ChatId).ToList();

            var lastMessages = await _context.Messages
                .AsNoTracking()
                .Include(m => m.MediaFiles)
                .Include(m => m.Poll)
                .Where(m => chatIds.Contains(m.ChatId))
                .Where(m => m.CreatedAt == _context.Messages
                    .Where(m2 => m2.ChatId == m.ChatId)
                    .Max(m2 => m2.CreatedAt))
                .ToListAsync(cancellationToken);

            if (lastMessages.Count == 0)
            {
                return;
            }

            var previewByChatId = lastMessages
                .GroupBy(m => m.ChatId)
                .ToDictionary(g => g.Key, g => BuildLastMessagePreview(g.First()));

            foreach (var chat in chats)
            {
                if (previewByChatId.TryGetValue(chat.ChatId, out var preview))
                {
                    chat.LastMessage = preview;
                }
            }
        }

        private static string BuildLastMessagePreview(Message message)
        {
            var media = message.MediaFiles.FirstOrDefault();
            var textContent = string.Equals(message.ContentType, "poll", StringComparison.OrdinalIgnoreCase)
                ? message.Poll?.Question
                : message.Content;

            return ChatMessagePreviewBuilder.BuildPreviewText(
                message.ContentType,
                textContent,
                media?.ContentType,
                media?.IsVideoNote ?? false);
        }

        public async Task<CreatePrivateChatResult> CreatePrivateChatAsync(Guid userId, Guid targetUserId, CancellationToken cancellationToken = default)
        {
            try
            {
                if (userId == targetUserId)
                {
                    return new CreatePrivateChatResult
                    {
                        Success = false,
                        ErrorMessage = "Используйте «Избранное» для сохранения сообщений себе"
                    };
                }

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
                .Include(c => c.Server)
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
                        Banner = m.User.UserProfile.Banner,
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

                if (chat.Type.TypeName == ChatTypeNames.Saved)
                {
                    return new ChatInfoDto
                    {
                        ChatId = chat.Id,
                        Name = "Избранное",
                        Type = "saved",
                        Avatar = null,
                        AvatarColor = "#5865F2",
                        Banner = null,
                        OtherUserId = userId
                    };
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
                            Banner = otherMember.User.UserProfile?.Banner,
                            OtherUserId = otherMember.UserId
                        };
                    }
                }

                var creatorUserId = await GetGroupCreatorUserIdAsync(chat.Id, cancellationToken);

                return new ChatInfoDto
                {
                    ChatId = chat.Id,
                    Name = chat.Name ?? "Групповой чат",
                    Type = "group",
                    Avatar = null,
                    AvatarColor = null,
                    ChatAvatar = chat.Avatar,
                    ChatAvatarColor = chat.AvatarColor,
                    OtherUserId = null,
                    CreatorUserId = creatorUserId
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

        public async Task<Guid?> GetGroupCreatorUserIdAsync(Guid chatId, CancellationToken cancellationToken = default)
        {
            var chat = await _context.Chats
                .AsNoTracking()
                .FirstOrDefaultAsync(c => c.Id == chatId, cancellationToken);

            if (chat?.CreatedByUserId != null)
            {
                return chat.CreatedByUserId;
            }

            return await _context.Members
                .Where(m => m.ChatId == chatId)
                .OrderBy(m => m.JoinedAt)
                .ThenBy(m => m.UserId)
                .Select(m => (Guid?)m.UserId)
                .FirstOrDefaultAsync(cancellationToken);
        }

        public async Task<bool> RemoveMemberFromGroupAsync(Guid groupChatId, Guid userId, CancellationToken cancellationToken = default)
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

                var member = await _context.Members
                    .FirstOrDefaultAsync(m => m.ChatId == groupChatId && m.UserId == userId, cancellationToken);

                if (member == null)
                {
                    return false;
                }

                _context.Members.Remove(member);
                await _context.SaveChangesAsync(cancellationToken);
                return true;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"ChatRepository - Error removing member from group: {ex.Message}");
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
                Console.WriteLine($"ChatRepository - Error checking user participation: {ex.Message}");
                return false;
            }
        }
    }
}
