using MediatR;
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

    public CreateServerCommandHandler(
        IServerRepository serverRepository,
        ICategoryRepository categoryRepository,
        IChatRepository chatRepository,
        IServerMemberRepository serverMemberRepository,
        IChatMemberRepository chatMemberRepository,
        IUserRepository userRepository)
    {
        _serverRepository = serverRepository;
        _categoryRepository = categoryRepository;
        _chatRepository = chatRepository;
        _serverMemberRepository = serverMemberRepository;
        _chatMemberRepository = chatMemberRepository;
        _userRepository = userRepository;
    }

    public async Task<CreateServerResult> Handle(CreateServerCommand request, CancellationToken cancellationToken)
    {
        try
        {
            // Проверяем, что владелец существует
            var owner = await _userRepository.GetByIdAsync(request.OwnerId, cancellationToken);
            if (owner == null)
            {
                return new CreateServerResult
                {
                    Success = false,
                    ErrorMessage = "Владелец сервера не найден"
                };
            }

            // Создаем сервер
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

            // Создаем категорию "Текстовые каналы"
            var category = new ChatCategory
            {
                Id = Guid.NewGuid(),
                CategoryName = "Текстовые каналы",
                ServerId = createdServer.Id,
                CategoryOrder = 0,
                IsPrivate = false
            };

            var createdCategory = await _categoryRepository.CreateAsync(category, cancellationToken);

            // Получаем тип чата "TextChannel" для текстового канала
            var chatType = await _chatRepository.GetChatTypeByNameAsync("TextChannel", cancellationToken);
            if (chatType == null)
            {
                return new CreateServerResult
                {
                    Success = false,
                    ErrorMessage = "Тип чата не найден"
                };
            }

            // Создаем чат "Основной"
            var chat = new Chat
            {
                Id = Guid.NewGuid(),
                Name = "Основной",
                TypeId = chatType.Id,
                CategoryId = createdCategory.Id,
                ServerId = createdServer.Id,
                CreatedAt = DateTimeOffset.UtcNow,
                ChatOrder = 0
            };

            await _chatRepository.CreateAsync(chat, cancellationToken);
            var createdChat = chat;

            // Добавляем владельца как участника сервера
            var serverMember = new ServerMember
            {
                Id = Guid.NewGuid(),
                ServerId = createdServer.Id,
                UserId = request.OwnerId,
                JoinedAt = DateTimeOffset.UtcNow
            };

            await _serverMemberRepository.CreateAsync(serverMember, cancellationToken);

            // Добавляем владельца как участника чата
            var chatMember = new Member
            {
                Id = Guid.NewGuid(),
                ChatId = createdChat.Id,
                UserId = request.OwnerId,
                JoinedAt = DateTimeOffset.UtcNow,
                Chat = createdChat,
                User = owner
            };

            await _chatMemberRepository.CreateAsync(chatMember, cancellationToken);

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
                    defaultChannelId = createdChat.Id,
                    position = 0 // TODO: Implement server ordering
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
