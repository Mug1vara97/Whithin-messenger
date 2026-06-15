using MediatR;
using WhithinMessenger.Application.Services;
using WhithinMessenger.Domain.Interfaces;
using WhithinMessenger.Domain.Models;

namespace WhithinMessenger.Application.CommandsAndQueries.Servers;

public class CreateServerCommandHandler : IRequestHandler<CreateServerCommand, CreateServerResult>
{
    private readonly IServerRepository _serverRepository;
    private readonly ICategoryRepository _categoryRepository;
    private readonly IChatRepository _chatRepository;
    private readonly IServerMemberRepository _serverMemberRepository;
    private readonly IChatMemberRepository _chatMemberRepository;
    private readonly IUserRepository _userRepository;
    private readonly IUserListCacheService _userListCache;

    public CreateServerCommandHandler(
        IServerRepository serverRepository,
        ICategoryRepository categoryRepository,
        IChatRepository chatRepository,
        IServerMemberRepository serverMemberRepository,
        IChatMemberRepository chatMemberRepository,
        IUserRepository userRepository,
        IUserListCacheService userListCache)
    {
        _serverRepository = serverRepository;
        _categoryRepository = categoryRepository;
        _chatRepository = chatRepository;
        _serverMemberRepository = serverMemberRepository;
        _chatMemberRepository = chatMemberRepository;
        _userRepository = userRepository;
        _userListCache = userListCache;
    }

    public async Task<CreateServerResult> Handle(CreateServerCommand request, CancellationToken cancellationToken)
    {
        try
        {
            var owner = await _userRepository.GetByIdAsync(request.OwnerId, cancellationToken);
            if (owner == null)
            {
                return new CreateServerResult
                {
                    Success = false,
                    ErrorMessage = "Владелец сервера не найден"
                };
            }

            var server = new Server
            {
                Id = Guid.NewGuid(),
                Name = request.ServerName.Trim(),
                OwnerId = request.OwnerId,
                CreatedAt = DateTimeOffset.UtcNow,
                IsPublic = request.IsPublic,
                Description = request.Description
            };

            var createdServer = await _serverRepository.CreateAsync(server, cancellationToken);

            var serverMember = new ServerMember
            {
                Id = Guid.NewGuid(),
                ServerId = createdServer.Id,
                UserId = request.OwnerId,
                JoinedAt = DateTimeOffset.UtcNow
            };

            await _serverMemberRepository.CreateAsync(serverMember, cancellationToken);

            var textChatType = await _chatRepository.GetChatTypeByNameAsync("TextChannel", cancellationToken);
            var voiceChatType = await _chatRepository.GetChatTypeByNameAsync("VoiceChannel", cancellationToken);
            if (textChatType == null || voiceChatType == null)
            {
                return new CreateServerResult
                {
                    Success = false,
                    ErrorMessage = "Тип чата не найден"
                };
            }

            var textCategory = new ChatCategory
            {
                Id = Guid.NewGuid(),
                CategoryName = "Текстовые каналы",
                ServerId = createdServer.Id,
                CategoryOrder = 0,
                IsPrivate = false
            };

            var createdTextCategory = await _categoryRepository.CreateAsync(textCategory, cancellationToken);

            var textChat = new Chat
            {
                Id = Guid.NewGuid(),
                Name = "Основной",
                TypeId = textChatType.Id,
                CategoryId = createdTextCategory.Id,
                ServerId = createdServer.Id,
                CreatedAt = DateTimeOffset.UtcNow,
                ChatOrder = 0
            };

            await _chatRepository.CreateAsync(textChat, cancellationToken);

            var voiceCategory = new ChatCategory
            {
                Id = Guid.NewGuid(),
                CategoryName = "Голосовые каналы",
                ServerId = createdServer.Id,
                CategoryOrder = 1,
                IsPrivate = false
            };

            var createdVoiceCategory = await _categoryRepository.CreateAsync(voiceCategory, cancellationToken);

            var voiceChat = new Chat
            {
                Id = Guid.NewGuid(),
                Name = "Общий",
                TypeId = voiceChatType.Id,
                CategoryId = createdVoiceCategory.Id,
                ServerId = createdServer.Id,
                CreatedAt = DateTimeOffset.UtcNow,
                ChatOrder = 0
            };

            await _chatRepository.CreateAsync(voiceChat, cancellationToken);

            var textChatMember = new Member
            {
                Id = Guid.NewGuid(),
                ChatId = textChat.Id,
                UserId = request.OwnerId,
                JoinedAt = DateTimeOffset.UtcNow,
                Chat = textChat,
                User = owner
            };

            await _chatMemberRepository.CreateAsync(textChatMember, cancellationToken);

            var voiceChatMember = new Member
            {
                Id = Guid.NewGuid(),
                ChatId = voiceChat.Id,
                UserId = request.OwnerId,
                JoinedAt = DateTimeOffset.UtcNow,
                Chat = voiceChat,
                User = owner
            };

            await _chatMemberRepository.CreateAsync(voiceChatMember, cancellationToken);

            await _userListCache.InvalidateUserServersAsync(request.OwnerId, cancellationToken);

            return new CreateServerResult
            {
                Success = true,
                Server = new
                {
                    serverId = createdServer.Id,
                    name = createdServer.Name,
                    ownerId = createdServer.OwnerId,
                    createdAt = createdServer.CreatedAt,
                    isPublic = createdServer.IsPublic,
                    description = createdServer.Description,
                    avatar = createdServer.Avatar,
                    banner = createdServer.Banner,
                    bannerColor = createdServer.BannerColor,
                    defaultChannelId = textChat.Id,
                    position = 0
                }
            };
        }
        catch (Exception ex)
        {
            return new CreateServerResult
            {
                Success = false,
                ErrorMessage = ex.Message
            };
        }
    }
}
