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
                .AsNoTracking()
                .Where(m => m.UserId == userId && m.Chat.Type.TypeName == "Private")
                .Select(m => new ChatInfo
                {
                    ChatId = m.ChatId,
                    IsPinned = m.IsPinned,
                    PinnedAt = m.PinnedAt,
                    PinOrder = m.PinOrder,
                    Username = _context.Members
                        .Where(member => member.ChatId == m.ChatId && member.UserId != userId)
                        .Select(member => member.User.UserProfile!.DisplayName ?? member.User.UserName)
                        .FirstOrDefault() ?? string.Empty,
                    UserId = _context.Members
                        .Where(member => member.ChatId == m.ChatId && member.UserId != userId)
                        .Select(member => member.UserId)
                        .FirstOrDefault(),
                    AvatarUrl = _context.Members
                        .Where(member => member.ChatId == m.ChatId && member.UserId != userId)
                        .Select(member => member.User.UserProfile.Avatar)
                        .FirstOrDefault(),
                    AvatarColor = _context.Members
                        .Where(member => member.ChatId == m.ChatId && member.UserId != userId)
                        .Select(member => member.User.UserProfile.AvatarColor)
                        .FirstOrDefault(),
                    Nameplate = _context.Members
                        .Where(member => member.ChatId == m.ChatId && member.UserId != userId)
                        .Select(member => member.User.UserProfile.Nameplate)
                        .FirstOrDefault(),
                    AvatarDecoration = _context.Members
                        .Where(member => member.ChatId == m.ChatId && member.UserId != userId)
                        .Select(member => member.User.UserProfile.AvatarDecoration)
                        .FirstOrDefault(),
                    UserStatus = _context.Members
                        .Where(member => member.ChatId == m.ChatId && member.UserId != userId)
                        .Select(member => member.User.Status.ToString().ToLower())
                        .FirstOrDefault() ?? "offline",
                    LastSeen = _context.Members
                        .Where(member => member.ChatId == m.ChatId && member.UserId != userId)
                        .Select(member => member.User.LastSeen)
                        .FirstOrDefault(),
                    IsGroupChat = false,
                    LastMessageTime = _context.Messages
                        .Where(message => message.ChatId == m.ChatId)
                        .Max(message => (DateTimeOffset?)message.CreatedAt) ?? DateTimeOffset.MinValue,
                })
                .ToListAsync(cancellationToken);

            var groupChats = await _context.Members
                .AsNoTracking()
                .Where(m => m.UserId == userId && m.Chat.Type.TypeName == "Group")
                .Select(m => new ChatInfo
                {
                    ChatId = m.ChatId,
                    IsPinned = m.IsPinned,
                    PinnedAt = m.PinnedAt,
                    PinOrder = m.PinOrder,
                    Username = m.Chat.Name ?? string.Empty,
                    UserId = userId,
                    AvatarUrl = m.Chat.Avatar,
                    AvatarColor = m.Chat.AvatarColor,
                    IsGroupChat = true,
                    LastMessageTime = _context.Messages
                        .Where(message => message.ChatId == m.ChatId)
                        .Max(message => (DateTimeOffset?)message.CreatedAt) ?? DateTimeOffset.MinValue,
                })
                .ToListAsync(cancellationToken);

            var chats = oneOnOneChats
                .Concat(groupChats)
                .ToList();

            var pinnedChats = chats
                .Where(c => c.IsPinned)
                .OrderBy(c => c.PinOrder ?? int.MaxValue)
                .ThenBy(c => c.PinnedAt ?? DateTimeOffset.MinValue)
                .ToList();

            var unpinnedChats = chats
                .Where(c => !c.IsPinned)
                .OrderByDescending(c => c.LastMessageTime)
                .ToList();

            chats = pinnedChats.Concat(unpinnedChats).ToList();

            chats.Insert(0, savedChat);

            await ApplyUnreadCountsAsync(chats, userId, cancellationToken);
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
                .AsNoTracking()
                .Where(m => m.UserId == userId && m.Chat.TypeId == savedChatType.Id && m.Chat.ServerId == null)
                .Select(m => m.Chat)
                .FirstOrDefaultAsync(cancellationToken);

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
                .AsNoTracking()
                .Where(m => m.ChatId == savedChat.Id)
                .MaxAsync(m => (DateTimeOffset?)m.CreatedAt, cancellationToken) ?? savedChat.CreatedAt;

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
                LastMessageTime = lastMessageTime,
                UnreadCount = 0,
            };
        }

        private async Task ApplyUnreadCountsAsync(
            List<ChatInfo> chats,
            Guid userId,
            CancellationToken cancellationToken)
        {
            if (chats.Count == 0)
            {
                return;
            }

            var chatIds = chats
                .Where(c => !c.IsSavedMessages)
                .Select(c => c.ChatId)
                .ToList();

            if (chatIds.Count == 0)
            {
                return;
            }

            var unreadByChatId = await _context.Messages
                .AsNoTracking()
                .Where(m => chatIds.Contains(m.ChatId) && m.UserId != userId)
                .Where(m => !_context.MessageReads.Any(mr => mr.MessageId == m.Id && mr.UserId == userId))
                .GroupBy(m => m.ChatId)
                .Select(g => new { ChatId = g.Key, Count = g.Count() })
                .ToDictionaryAsync(x => x.ChatId, x => x.Count, cancellationToken);

            foreach (var chat in chats)
            {
                if (unreadByChatId.TryGetValue(chat.ChatId, out var count))
                {
                    chat.UnreadCount = count;
                }
            }
        }

        private async Task ApplyLastMessagePreviewsAsync(List<ChatInfo> chats, CancellationToken cancellationToken)
        {
            if (chats.Count == 0)
            {
                return;
            }

            var chatIds = chats.Select(c => c.ChatId).ToList();

            var lastMessageIds = await _context.Messages
                .AsNoTracking()
                .Where(m => chatIds.Contains(m.ChatId))
                .GroupBy(m => m.ChatId)
                .Select(g => g.OrderByDescending(m => m.CreatedAt).ThenByDescending(m => m.Id).Select(m => m.Id).First())
                .ToListAsync(cancellationToken);

            if (lastMessageIds.Count == 0)
            {
                return;
            }

            var lastMessages = await _context.Messages
                .AsNoTracking()
                .AsSplitQuery()
                .Include(m => m.MediaFiles)
                .Include(m => m.Poll)
                .Where(m => lastMessageIds.Contains(m.Id))
                .ToListAsync(cancellationToken);

            if (lastMessages.Count == 0)
            {
                return;
            }

            var previewByChatId = lastMessages
                .GroupBy(m => m.ChatId)
                .ToDictionary(g => g.Key, g => g.First());

            foreach (var chat in chats)
            {
                if (previewByChatId.TryGetValue(chat.ChatId, out var message))
                {
                    ApplyLastMessagePreview(chat, message);
                }
            }
        }

        private static void ApplyLastMessagePreview(ChatInfo chat, Message message)
        {
            if (message.EncryptionVersion > 0 && !string.IsNullOrWhiteSpace(message.Content))
            {
                chat.LastMessage = "Зашифрованное сообщение";
                chat.LastMessageEncryptionVersion = message.EncryptionVersion;
                chat.LastMessageEncryptedPayload = message.Content;
                chat.LastMessageSenderId = message.UserId;
                return;
            }

            chat.LastMessage = BuildLastMessagePreview(message);
            chat.LastMessageEncryptionVersion = 0;
            chat.LastMessageEncryptedPayload = null;
            chat.LastMessageSenderId = message.UserId;
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
                .AsNoTracking()
                .Where(m => m.ChatId == chatId)
                .Select(m => m.UserId)
                .ToListAsync(cancellationToken);
        }

        public async Task<int> GetChatMemberCountAsync(Guid chatId, CancellationToken cancellationToken = default)
        {
            return await _context.Members
                .AsNoTracking()
                .CountAsync(m => m.ChatId == chatId, cancellationToken);
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
                        Login = m.User.UserName ?? string.Empty,
                        DisplayName = m.User.UserProfile!.DisplayName != null
                            && m.User.UserProfile.DisplayName.Trim() != string.Empty
                            ? m.User.UserProfile.DisplayName.Trim()
                            : null,
                        Username = m.User.UserProfile!.DisplayName != null
                            && m.User.UserProfile.DisplayName.Trim() != string.Empty
                            ? m.User.UserProfile.DisplayName.Trim()
                            : (m.User.UserName ?? string.Empty),
                        AvatarUrl = m.User.UserProfile.Avatar,
                        AvatarColor = m.User.UserProfile.AvatarColor,
                        Banner = m.User.UserProfile.Banner,
                        Nameplate = m.User.UserProfile.Nameplate,
                        AvatarDecoration = m.User.UserProfile.AvatarDecoration,
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
                            Name = UserDisplayNames.Resolve(
                                otherMember.User.UserProfile?.DisplayName,
                                otherMember.User.UserName,
                                "Пользователь"),
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
                var isParticipant = await IsUserParticipantAsync(groupChatId, currentUserId, cancellationToken);
                if (!isParticipant)
                {
                    return [];
                }

                var friendIds = await _context.Friendships
                    .AsNoTracking()
                    .Where(f =>
                        f.Status == FriendshipStatus.Accepted &&
                        (f.RequesterId == currentUserId || f.AddresseeId == currentUserId))
                    .Select(f => f.RequesterId == currentUserId ? f.AddresseeId : f.RequesterId)
                    .ToListAsync(cancellationToken);

                var groupMembers = await _context.Members
                    .AsNoTracking()
                    .Where(m => m.ChatId == groupChatId)
                    .Select(m => m.UserId)
                    .ToListAsync(cancellationToken);

                var availableFriendIds = friendIds
                    .Where(id => !groupMembers.Contains(id))
                    .ToList();

                if (availableFriendIds.Count == 0)
                {
                    return [];
                }

                var users = await _context.Users
                    .AsNoTracking()
                    .Include(u => u.UserProfile)
                    .Where(u => availableFriendIds.Contains(u.Id))
                    .ToListAsync(cancellationToken);

                return users
                    .Select(u => new AvailableUserInfo
                    {
                        UserId = u.Id,
                        Username = UserDisplayNames.Resolve(u.UserProfile?.DisplayName, u.UserName) ?? string.Empty,
                        AvatarUrl = u.UserProfile?.Avatar,
                        AvatarColor = u.UserProfile?.AvatarColor,
                        UserStatus = u.Status.ToString().ToLowerInvariant(),
                        LastSeen = u.LastSeen,
                        HasExistingChat = false
                    })
                    .OrderBy(u => u.Username, StringComparer.OrdinalIgnoreCase)
                    .ToList();
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

        public async Task<bool> SetChatPinnedAsync(
            Guid userId,
            Guid chatId,
            bool isPinned,
            CancellationToken cancellationToken = default)
        {
            var member = await _context.Members
                .Include(m => m.Chat)
                .ThenInclude(c => c.Type)
                .FirstOrDefaultAsync(m => m.UserId == userId && m.ChatId == chatId, cancellationToken);

            if (member == null)
            {
                return false;
            }

            if (member.Chat.Type.TypeName == ChatTypeNames.Saved)
            {
                return false;
            }

            member.IsPinned = isPinned;
            if (isPinned)
            {
                member.PinnedAt = DateTimeOffset.UtcNow;

                var otherPinnedMembers = await _context.Members
                    .Where(m => m.UserId == userId && m.IsPinned && m.ChatId != chatId)
                    .OrderBy(m => m.PinOrder ?? int.MaxValue)
                    .ThenBy(m => m.PinnedAt ?? DateTimeOffset.MinValue)
                    .ToListAsync(cancellationToken);

                for (var index = 0; index < otherPinnedMembers.Count; index++)
                {
                    if (otherPinnedMembers[index].PinOrder == null)
                    {
                        otherPinnedMembers[index].PinOrder = index;
                    }
                }

                var maxPinOrder = otherPinnedMembers.Count > 0
                    ? otherPinnedMembers.Max(m => m.PinOrder ?? -1)
                    : -1;
                member.PinOrder = maxPinOrder + 1;
            }
            else
            {
                member.PinnedAt = null;
                member.PinOrder = null;
            }

            await _context.SaveChangesAsync(cancellationToken);
            return true;
        }

        public async Task<bool> ReorderPinnedChatsAsync(
            Guid userId,
            IReadOnlyList<Guid> chatIds,
            CancellationToken cancellationToken = default)
        {
            if (chatIds.Count == 0)
            {
                return true;
            }

            var pinnedMembers = await _context.Members
                .Where(m => m.UserId == userId && m.IsPinned)
                .ToListAsync(cancellationToken);

            var pinnedChatIds = pinnedMembers
                .Select(m => m.ChatId)
                .ToHashSet();

            if (chatIds.Count != pinnedMembers.Count
                || chatIds.Any(chatId => !pinnedChatIds.Contains(chatId)))
            {
                return false;
            }

            var membersByChatId = pinnedMembers.ToDictionary(m => m.ChatId);
            for (var index = 0; index < chatIds.Count; index++)
            {
                membersByChatId[chatIds[index]].PinOrder = index;
            }

            await _context.SaveChangesAsync(cancellationToken);
            return true;
        }
    }
}
