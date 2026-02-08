using MediatR;
using WhithinMessenger.Domain.Interfaces;
using WhithinMessenger.Domain.Models;

namespace WhithinMessenger.Application.CommandsAndQueries.Servers;

public class DeleteCategoryCommandHandler : IRequestHandler<DeleteCategoryCommand, DeleteCategoryResult>
{
    private readonly ICategoryRepository _categoryRepository;

    public DeleteCategoryCommandHandler(ICategoryRepository categoryRepository)
    {
        _categoryRepository = categoryRepository;
    }

    public async Task<DeleteCategoryResult> Handle(DeleteCategoryCommand request, CancellationToken cancellationToken)
    {
        try
        {
            var category = await _categoryRepository.GetByIdAsync(request.CategoryId, cancellationToken);
            if (category == null)
            {
                return new DeleteCategoryResult { Success = false, ErrorMessage = "Категория не найдена" };
            }

            if (category.ServerId != request.ServerId)
            {
                return new DeleteCategoryResult { Success = false, ErrorMessage = "Категория не принадлежит указанному серверу" };
            }

            await _categoryRepository.DeleteAsync(request.CategoryId, cancellationToken);

            return new DeleteCategoryResult { Success = true };
        }
        catch (Exception ex)
        {
            return new DeleteCategoryResult { Success = false, ErrorMessage = $"Ошибка при удалении категории: {ex.Message}" };
        }
    }
}


public class CreateChatCommandHandler : IRequestHandler<CreateChatCommand, CreateChatResult>
{
    private readonly IChatRepository _chatRepository;
    private readonly ICategoryRepository _categoryRepository;
    private readonly IChatMemberRepository _chatMemberRepository;
    private readonly IUserRepository _userRepository;
    private readonly IServerRepository _serverRepository;

    public CreateChatCommandHandler(
        IChatRepository chatRepository,
        ICategoryRepository categoryRepository,
        IChatMemberRepository chatMemberRepository,
        IUserRepository userRepository,
        IServerRepository serverRepository)
    {
        _chatRepository = chatRepository;
        _categoryRepository = categoryRepository;
        _chatMemberRepository = chatMemberRepository;
        _userRepository = userRepository;
        _serverRepository = serverRepository;
    }

    public async Task<CreateChatResult> Handle(CreateChatCommand request, CancellationToken cancellationToken)
    {
        try
        {
            if (request.CategoryId.HasValue)
            {
                var category = await _categoryRepository.GetByIdAsync(request.CategoryId.Value, cancellationToken);
                if (category == null)
                {
                    return new CreateChatResult { Success = false, ErrorMessage = "Категория не найдена" };
                }
            }

            Guid typeId = request.ChatType switch
            {
                1 => Guid.Parse("11111111-1111-1111-1111-111111111111"), // Private
                2 => Guid.Parse("22222222-2222-2222-2222-222222222222"), // Group
                3 => Guid.Parse("33333333-3333-3333-3333-333333333333"), // TextChannel
                4 => Guid.Parse("44444444-4444-4444-4444-444444444444"), // VoiceChannel
                _ => Guid.Parse("33333333-3333-3333-3333-333333333333")  // По умолчанию TextChannel
            };

            var existingChats = await _chatRepository.GetByServerIdAsync(request.ServerId, cancellationToken);
            var maxOrder = existingChats
                .Where(c => c.CategoryId == request.CategoryId)
                .Select(c => c.ChatOrder)
                .DefaultIfEmpty(0)
                .Max();

            var chat = new Chat
            {
                Id = Guid.NewGuid(),
                Name = request.ChatName,
                ServerId = request.ServerId,
                CategoryId = request.CategoryId,
                TypeId = typeId,
                CreatedAt = DateTime.UtcNow,
                IsPrivate = request.IsPrivate,
                ChatOrder = maxOrder + 1
            };

            await _chatRepository.CreateAsync(chat, cancellationToken);

            var memberUserIds = new List<Guid> { request.UserId };
            if (request.IsPrivate && request.MemberIds != null)
            {
                var isServerMember = await _serverRepository.IsUserMemberAsync(request.ServerId, request.UserId, cancellationToken);
                if (!isServerMember)
                {
                    await _chatRepository.DeleteAsync(chat.Id, cancellationToken);
                    return new CreateChatResult { Success = false, ErrorMessage = "Вы не являетесь участником сервера" };
                }
                foreach (var uid in request.MemberIds)
                {
                    if (uid == request.UserId) continue;
                    var onServer = await _serverRepository.IsUserMemberAsync(request.ServerId, uid, cancellationToken);
                    if (onServer && !memberUserIds.Contains(uid))
                        memberUserIds.Add(uid);
                }
            }

            if (request.IsPrivate && memberUserIds.Count > 0)
            {
                var membersToAdd = new List<Member>();
                var chatLoaded = await _chatRepository.GetByIdAsync(chat.Id, cancellationToken);
                if (chatLoaded == null) chatLoaded = chat;

                foreach (var uid in memberUserIds)
                {
                    var appUser = await _userRepository.GetByIdAsync(uid, cancellationToken);
                    if (appUser == null) continue;
                    membersToAdd.Add(new Member
                    {
                        Id = Guid.NewGuid(),
                        ChatId = chat.Id,
                        UserId = uid,
                        JoinedAt = DateTimeOffset.UtcNow,
                        Chat = chatLoaded,
                        User = appUser
                    });
                }
                if (membersToAdd.Count > 0)
                    await _chatMemberRepository.AddRangeAsync(membersToAdd, cancellationToken);
            }

            var result = new
            {
                chatId = chat.Id,
                name = chat.Name,
                serverId = chat.ServerId,
                categoryId = chat.CategoryId,
                typeId = chat.TypeId,
                createdAt = chat.CreatedAt,
                isPrivate = chat.IsPrivate,
                chatOrder = chat.ChatOrder,
                members = memberUserIds.Select(uid => new { userId = uid }).ToList()
            };

            return new CreateChatResult
            {
                Success = true,
                Chat = result,
                NotifyUserIds = request.IsPrivate ? memberUserIds : null
            };
        }
        catch (Exception ex)
        {
            return new CreateChatResult { Success = false, ErrorMessage = $"Ошибка при создании чата: {ex.Message}" };
        }
    }
}

public class DeleteChatCommandHandler : IRequestHandler<DeleteChatCommand, DeleteChatResult>
{
    private readonly IChatRepository _chatRepository;

    public DeleteChatCommandHandler(IChatRepository chatRepository)
    {
        _chatRepository = chatRepository;
    }

    public async Task<DeleteChatResult> Handle(DeleteChatCommand request, CancellationToken cancellationToken)
    {
        try
        {
            var chat = await _chatRepository.GetByIdAsync(request.ChatId, cancellationToken);
            if (chat == null)
            {
                return new DeleteChatResult { Success = false, ErrorMessage = "Чат не найден" };
            }

            if (chat.ServerId != request.ServerId)
            {
                return new DeleteChatResult { Success = false, ErrorMessage = "Чат не принадлежит указанному серверу" };
            }
            var categoryId = chat.CategoryId;

            await _chatRepository.DeleteAsync(request.ChatId, cancellationToken);

            return new DeleteChatResult { Success = true, CategoryId = categoryId };
        }
        catch (Exception ex)
        {
            return new DeleteChatResult { Success = false, ErrorMessage = $"Ошибка при удалении чата: {ex.Message}" };
        }
    }
}

public class UpdateChatNameCommandHandler : IRequestHandler<UpdateChatNameCommand, UpdateChatNameResult>
{
    private readonly IChatRepository _chatRepository;

    public UpdateChatNameCommandHandler(IChatRepository chatRepository)
    {
        _chatRepository = chatRepository;
    }

    public async Task<UpdateChatNameResult> Handle(UpdateChatNameCommand request, CancellationToken cancellationToken)
    {
        try
        {
            var chat = await _chatRepository.GetByIdAsync(request.ChatId, cancellationToken);
            if (chat == null)
            {
                return new UpdateChatNameResult { Success = false, ErrorMessage = "Чат не найден" };
            }

            if (chat.ServerId != request.ServerId)
            {
                return new UpdateChatNameResult { Success = false, ErrorMessage = "Чат не принадлежит указанному серверу" };
            }

            chat.Name = request.NewName;
            await _chatRepository.UpdateAsync(chat, cancellationToken);

            var result = new
            {
                chatId = chat.Id,
                name = chat.Name,
                serverId = chat.ServerId,
                categoryId = chat.CategoryId,
                typeId = chat.TypeId,
                createdAt = chat.CreatedAt,
                isPrivate = chat.IsPrivate,
                chatOrder = 0
            };

            return new UpdateChatNameResult { Success = true, Chat = result };
        }
        catch (Exception ex)
        {
            return new UpdateChatNameResult { Success = false, ErrorMessage = $"Ошибка при обновлении названия чата: {ex.Message}" };
        }
    }
}


public class GetRolesQueryHandler : IRequestHandler<GetRolesQuery, GetRolesResult>
{
    private readonly IRoleRepository _roleRepository;

    public GetRolesQueryHandler(IRoleRepository roleRepository)
    {
        _roleRepository = roleRepository;
    }

    public Task<GetRolesResult> Handle(GetRolesQuery request, CancellationToken cancellationToken)
    {
        try
        {
            return Task.FromResult(new GetRolesResult { Success = true, Roles = new List<object>() });
        }
        catch (Exception ex)
        {
            return Task.FromResult(new GetRolesResult { Success = false, ErrorMessage = ex.Message });
        }
    }
}

public class CreateRoleCommandHandler : IRequestHandler<CreateRoleCommand, CreateRoleResult>
{
    private readonly IRoleRepository _roleRepository;

    public CreateRoleCommandHandler(IRoleRepository roleRepository)
    {
        _roleRepository = roleRepository;
    }

    public Task<CreateRoleResult> Handle(CreateRoleCommand request, CancellationToken cancellationToken)
    {
        try
        {
            return Task.FromResult(new CreateRoleResult { Success = true, Role = new { } });
        }
        catch (Exception ex)
        {
            return Task.FromResult(new CreateRoleResult { Success = false, ErrorMessage = ex.Message });
        }
    }
}

public class UpdateRoleCommandHandler : IRequestHandler<UpdateRoleCommand, UpdateRoleResult>
{
    private readonly IRoleRepository _roleRepository;

    public UpdateRoleCommandHandler(IRoleRepository roleRepository)
    {
        _roleRepository = roleRepository;
    }

    public Task<UpdateRoleResult> Handle(UpdateRoleCommand request, CancellationToken cancellationToken)
    {
        try
        {
            return Task.FromResult(new UpdateRoleResult { Success = true, Role = new { }, ServerId = Guid.NewGuid() });
        }
        catch (Exception ex)
        {
            return Task.FromResult(new UpdateRoleResult { Success = false, ErrorMessage = ex.Message });
        }
    }
}

public class DeleteRoleCommandHandler : IRequestHandler<DeleteRoleCommand, DeleteRoleResult>
{
    private readonly IRoleRepository _roleRepository;

    public DeleteRoleCommandHandler(IRoleRepository roleRepository)
    {
        _roleRepository = roleRepository;
    }

    public Task<DeleteRoleResult> Handle(DeleteRoleCommand request, CancellationToken cancellationToken)
    {
        try
        {
            return Task.FromResult(new DeleteRoleResult { Success = true, ServerId = Guid.NewGuid() });
        }
        catch (Exception ex)
        {
            return Task.FromResult(new DeleteRoleResult { Success = false, ErrorMessage = ex.Message });
        }
    }
}

public class GetServerMembersQueryHandler : IRequestHandler<GetServerMembersQuery, GetServerMembersResult>
{
    private readonly IServerMemberRepository _serverMemberRepository;

    public GetServerMembersQueryHandler(IServerMemberRepository serverMemberRepository)
    {
        _serverMemberRepository = serverMemberRepository;
    }

    public async Task<GetServerMembersResult> Handle(GetServerMembersQuery request, CancellationToken cancellationToken)
    {
        try
        {
            var isMember = await _serverMemberRepository.IsUserMemberAsync(request.ServerId, request.UserId, cancellationToken);
            if (!isMember)
            {
                return new GetServerMembersResult
                {
                    Success = false,
                    ErrorMessage = "Вы не являетесь участником этого сервера"
                };
            }

            var members = await _serverMemberRepository.GetServerMembersAsync(request.ServerId, cancellationToken);

            return new GetServerMembersResult
            {
                Success = true,
                Members = members
            };
        }
        catch (Exception ex)
        {
            return new GetServerMembersResult
            {
                Success = false,
                ErrorMessage = ex.Message
            };
        }
    }
}

public class AssignRoleCommandHandler : IRequestHandler<AssignRoleCommand, AssignRoleResult>
{
    private readonly IRoleRepository _roleRepository;

    public AssignRoleCommandHandler(IRoleRepository roleRepository)
    {
        _roleRepository = roleRepository;
    }

    public Task<AssignRoleResult> Handle(AssignRoleCommand request, CancellationToken cancellationToken)
    {
        try
        {
            return Task.FromResult(new AssignRoleResult { Success = true, Role = new { }, ServerId = Guid.NewGuid() });
        }
        catch (Exception ex)
        {
            return Task.FromResult(new AssignRoleResult { Success = false, ErrorMessage = ex.Message });
        }
    }
}

public class RemoveRoleCommandHandler : IRequestHandler<RemoveRoleCommand, RemoveRoleResult>
{
    private readonly IRoleRepository _roleRepository;

    public RemoveRoleCommandHandler(IRoleRepository roleRepository)
    {
        _roleRepository = roleRepository;
    }

    public Task<RemoveRoleResult> Handle(RemoveRoleCommand request, CancellationToken cancellationToken)
    {
        try
        {
            return Task.FromResult(new RemoveRoleResult { Success = true, RemainingRoles = new List<object>(), MergedPermissions = new { }, ServerId = Guid.NewGuid() });
        }
        catch (Exception ex)
        {
            return Task.FromResult(new RemoveRoleResult { Success = false, ErrorMessage = ex.Message });
        }
    }
}

public class KickMemberCommandHandler : IRequestHandler<KickMemberCommand, KickMemberResult>
{
    private readonly IMemberRepository _memberRepository;

    public KickMemberCommandHandler(IMemberRepository memberRepository)
    {
        _memberRepository = memberRepository;
    }

    public Task<KickMemberResult> Handle(KickMemberCommand request, CancellationToken cancellationToken)
    {
        try
        {
            return Task.FromResult(new KickMemberResult { Success = true });
        }
        catch (Exception ex)
        {
            return Task.FromResult(new KickMemberResult { Success = false, ErrorMessage = ex.Message });
        }
    }
}

public class GetUserRolesQueryHandler : IRequestHandler<GetUserRolesQuery, GetUserRolesResult>
{
    private readonly IRoleRepository _roleRepository;

    public GetUserRolesQueryHandler(IRoleRepository roleRepository)
    {
        _roleRepository = roleRepository;
    }

    public Task<GetUserRolesResult> Handle(GetUserRolesQuery request, CancellationToken cancellationToken)
    {
        try
        {   
            return Task.FromResult(new GetUserRolesResult { Success = true, Roles = new List<object>() });
        }
        catch (Exception ex)
        {
            return Task.FromResult(new GetUserRolesResult { Success = false, ErrorMessage = ex.Message });
        }
    }
}

public class UpdateServerNameCommandHandler : IRequestHandler<UpdateServerNameCommand, UpdateServerNameResult>
{
    private readonly IServerRepository _serverRepository;

    public UpdateServerNameCommandHandler(IServerRepository serverRepository)
    {
        _serverRepository = serverRepository;
    }

    public async Task<UpdateServerNameResult> Handle(UpdateServerNameCommand request, CancellationToken cancellationToken)
    {
        try
        {
            var server = await _serverRepository.GetByIdAsync(request.ServerId);
            if (server == null)
            {
                return new UpdateServerNameResult { Success = false, ErrorMessage = "Сервер не найден" };
            }

            if (server.OwnerId != request.UserId)
            {
                return new UpdateServerNameResult { Success = false, ErrorMessage = "Только владелец сервера может изменить его название" };
            }

            server.Name = request.NewName;
            await _serverRepository.UpdateAsync(server);

            return new UpdateServerNameResult { Success = true };
        }
        catch (Exception ex)
        {
            return new UpdateServerNameResult { Success = false, ErrorMessage = ex.Message };
        }
    }
}

public class GetServerInfoQueryHandler : IRequestHandler<GetServerInfoQuery, GetServerInfoResult>
{
    private readonly IServerRepository _serverRepository;

    public GetServerInfoQueryHandler(IServerRepository serverRepository)
    {
        _serverRepository = serverRepository;
    }

    public async Task<GetServerInfoResult> Handle(GetServerInfoQuery request, CancellationToken cancellationToken)
    {
        try
        {
            var server = await _serverRepository.GetByIdAsync(request.ServerId);
            if (server == null)
            {
                return new GetServerInfoResult { Success = false, ErrorMessage = "Сервер не найден" };
            }

            var userServers = await _serverRepository.GetUserServersAsync(request.UserId);
            if (!userServers.Any(s => s.Id == request.ServerId))
            {
                return new GetServerInfoResult { Success = false, ErrorMessage = "У вас нет доступа к этому серверу" };
            }

            var serverInfo = new
            {
                serverId = server.Id,
                name = server.Name,
                ownerId = server.OwnerId,
                createdAt = server.CreatedAt,
                isPublic = server.IsPublic,
                description = server.Description,
                avatar = server.Avatar,
                banner = server.Banner,
                bannerColor = server.BannerColor
            };

            return new GetServerInfoResult { Success = true, ServerInfo = serverInfo };
        }
        catch (Exception ex)
        {
            return new GetServerInfoResult { Success = false, ErrorMessage = ex.Message };
        }
    }
}

public class GetAuditLogQueryHandler : IRequestHandler<GetAuditLogQuery, GetAuditLogResult>
{
    private readonly IServerRepository _serverRepository;

    public GetAuditLogQueryHandler(IServerRepository serverRepository)
    {
        _serverRepository = serverRepository;
    }

    public Task<GetAuditLogResult> Handle(GetAuditLogQuery request, CancellationToken cancellationToken)
    {
        try
        {
            return Task.FromResult(new GetAuditLogResult { Success = true, AuditLogs = new List<object>() });
        }
        catch (Exception ex)
        {
            return Task.FromResult(new GetAuditLogResult { Success = false, ErrorMessage = ex.Message });
        }
    }
}

public class AddMemberToChannelCommandHandler : IRequestHandler<AddMemberToChannelCommand, AddMemberToChannelResult>
{
    private readonly IChatRepository _chatRepository;
    private readonly IChatMemberRepository _chatMemberRepository;
    private readonly IUserRepository _userRepository;
    private readonly IServerRepository _serverRepository;

    public AddMemberToChannelCommandHandler(
        IChatRepository chatRepository,
        IChatMemberRepository chatMemberRepository,
        IUserRepository userRepository,
        IServerRepository serverRepository)
    {
        _chatRepository = chatRepository;
        _chatMemberRepository = chatMemberRepository;
        _userRepository = userRepository;
        _serverRepository = serverRepository;
    }

    public async Task<AddMemberToChannelResult> Handle(AddMemberToChannelCommand request, CancellationToken cancellationToken)
    {
        try
        {
            var chat = await _chatRepository.GetByIdAsync(request.ChatId, cancellationToken);
            if (chat == null || chat.ServerId != request.ServerId)
            {
                return new AddMemberToChannelResult { Success = false, ErrorMessage = "Канал не найден" };
            }
            if (!chat.IsPrivate)
            {
                return new AddMemberToChannelResult { Success = false, ErrorMessage = "Канал не является приватным" };
            }

            var currentUserIsMember = await _serverRepository.IsUserMemberAsync(request.ServerId, request.CurrentUserId, cancellationToken);
            if (!currentUserIsMember)
            {
                return new AddMemberToChannelResult { Success = false, ErrorMessage = "Вы не являетесь участником сервера" };
            }
            var currentUserInChannel = await _chatMemberRepository.IsMemberAsync(request.ChatId, request.CurrentUserId, cancellationToken);
            if (!currentUserInChannel)
            {
                var server = await _serverRepository.GetByIdAsync(request.ServerId, cancellationToken);
                if (server == null || server.OwnerId != request.CurrentUserId)
                {
                    return new AddMemberToChannelResult { Success = false, ErrorMessage = "Нет прав для добавления в этот канал" };
                }
            }

            var userToAddIsOnServer = await _serverRepository.IsUserMemberAsync(request.ServerId, request.UserIdToAdd, cancellationToken);
            if (!userToAddIsOnServer)
            {
                return new AddMemberToChannelResult { Success = false, ErrorMessage = "Пользователь не является участником сервера" };
            }
            var alreadyInChannel = await _chatMemberRepository.IsMemberAsync(request.ChatId, request.UserIdToAdd, cancellationToken);
            if (alreadyInChannel)
            {
                return new AddMemberToChannelResult { Success = true };
            }

            var appUser = await _userRepository.GetByIdAsync(request.UserIdToAdd, cancellationToken);
            if (appUser == null)
            {
                return new AddMemberToChannelResult { Success = false, ErrorMessage = "Пользователь не найден" };
            }

            await _chatMemberRepository.CreateAsync(new Member
            {
                Id = Guid.NewGuid(),
                ChatId = request.ChatId,
                UserId = request.UserIdToAdd,
                JoinedAt = DateTimeOffset.UtcNow,
                Chat = chat,
                User = appUser
            }, cancellationToken);

            return new AddMemberToChannelResult { Success = true };
        }
        catch (Exception ex)
        {
            return new AddMemberToChannelResult { Success = false, ErrorMessage = ex.Message };
        }
    }
}

public class RemoveMemberFromChannelCommandHandler : IRequestHandler<RemoveMemberFromChannelCommand, RemoveMemberFromChannelResult>
{
    private readonly IChatRepository _chatRepository;
    private readonly IChatMemberRepository _chatMemberRepository;
    private readonly IServerRepository _serverRepository;

    public RemoveMemberFromChannelCommandHandler(
        IChatRepository chatRepository,
        IChatMemberRepository chatMemberRepository,
        IServerRepository serverRepository)
    {
        _chatRepository = chatRepository;
        _chatMemberRepository = chatMemberRepository;
        _serverRepository = serverRepository;
    }

    public async Task<RemoveMemberFromChannelResult> Handle(RemoveMemberFromChannelCommand request, CancellationToken cancellationToken)
    {
        try
        {
            var chat = await _chatRepository.GetByIdAsync(request.ChatId, cancellationToken);
            if (chat == null || chat.ServerId != request.ServerId)
            {
                return new RemoveMemberFromChannelResult { Success = false, ErrorMessage = "Канал не найден" };
            }
            if (!chat.IsPrivate)
            {
                return new RemoveMemberFromChannelResult { Success = false, ErrorMessage = "Канал не является приватным" };
            }

            var currentUserIsMember = await _serverRepository.IsUserMemberAsync(request.ServerId, request.CurrentUserId, cancellationToken);
            if (!currentUserIsMember)
            {
                return new RemoveMemberFromChannelResult { Success = false, ErrorMessage = "Вы не являетесь участником сервера" };
            }

            if (request.UserIdToRemove == request.CurrentUserId)
            {
                var channelMembers = await _chatMemberRepository.GetByChatIdAsync(request.ChatId, cancellationToken);
                var member = channelMembers.FirstOrDefault(m => m.UserId == request.CurrentUserId);
                if (member != null)
                {
                    await _chatMemberRepository.DeleteAsync(member.Id, cancellationToken);
                }
                return new RemoveMemberFromChannelResult { Success = true };
            }

            var server = await _serverRepository.GetByIdAsync(request.ServerId, cancellationToken);
            var currentUserInChannel = await _chatMemberRepository.IsMemberAsync(request.ChatId, request.CurrentUserId, cancellationToken);
            if (server?.OwnerId != request.CurrentUserId && !currentUserInChannel)
            {
                return new RemoveMemberFromChannelResult { Success = false, ErrorMessage = "Нет прав для удаления из канала" };
            }

            var channelMembersToRemove = await _chatMemberRepository.GetByChatIdAsync(request.ChatId, cancellationToken);
            var toRemove = channelMembersToRemove.FirstOrDefault(m => m.UserId == request.UserIdToRemove);
            if (toRemove == null)
            {
                return new RemoveMemberFromChannelResult { Success = true };
            }
            await _chatMemberRepository.DeleteAsync(toRemove.Id, cancellationToken);
            return new RemoveMemberFromChannelResult { Success = true };
        }
        catch (Exception ex)
        {
            return new RemoveMemberFromChannelResult { Success = false, ErrorMessage = ex.Message };
        }
    }
}
