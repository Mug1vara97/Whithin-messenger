using MediatR;
using WhithinMessenger.Application.Services;
using WhithinMessenger.Domain.Interfaces;
using WhithinMessenger.Domain.Models;
using System.Text.Json;

namespace WhithinMessenger.Application.CommandsAndQueries.Servers;

public class CreatePrivateCategoryCommandHandler : IRequestHandler<CreatePrivateCategoryCommand, CreatePrivateCategoryResult>
{
    private readonly IServerRepository _serverRepository;
    private readonly ICategoryRepository _categoryRepository;
    private readonly ServerPermissionChecker _permissionChecker;
    private readonly IServerAuditLogService _auditLog;

    public CreatePrivateCategoryCommandHandler(
        IServerRepository serverRepository,
        ICategoryRepository categoryRepository,
        ServerPermissionChecker permissionChecker,
        IServerAuditLogService auditLog)
    {
        _serverRepository = serverRepository;
        _categoryRepository = categoryRepository;
        _permissionChecker = permissionChecker;
        _auditLog = auditLog;
    }

    public async Task<CreatePrivateCategoryResult> Handle(CreatePrivateCategoryCommand request, CancellationToken cancellationToken)
    {
        try
        {
            var server = await _serverRepository.GetByIdAsync(request.ServerId, cancellationToken);
            if (server == null)
            {
                return new CreatePrivateCategoryResult
                {
                    Success = false,
                    ErrorMessage = "Сервер не найден"
                };
            }

            if (!await _permissionChecker.HasPermissionAsync(
                    request.ServerId, request.UserId, "manageChannels", cancellationToken))
            {
                return new CreatePrivateCategoryResult
                {
                    Success = false,
                    ErrorMessage = "Недостаточно прав для управления каналами"
                };
            }

            if (!await _serverRepository.UserHasAccessAsync(request.ServerId, request.UserId, cancellationToken))
            {
                return new CreatePrivateCategoryResult
                {
                    Success = false,
                    ErrorMessage = "У вас нет доступа к этому серверу"
                };
            }

            if (await _categoryRepository.ExistsAsync(request.ServerId, request.CategoryName, cancellationToken))
            {
                return new CreatePrivateCategoryResult
                {
                    Success = false,
                    ErrorMessage = "Категория с таким именем уже существует"
                };
            }

            var categories = await _categoryRepository.GetByServerIdAsync(request.ServerId, cancellationToken);
            var categoryOrder = categories.Count;

            var newCategory = new ChatCategory
            {
                Id = Guid.NewGuid(),
                CategoryName = request.CategoryName.Trim(),
                ServerId = request.ServerId,
                CategoryOrder = categoryOrder,
                IsPrivate = true,
                AllowedRoleIds = JsonSerializer.Serialize(request.AllowedRoleIds),
                AllowedUserIds = JsonSerializer.Serialize(request.AllowedUserIds)
            };

            var createdCategory = await _categoryRepository.CreateAsync(newCategory, cancellationToken);

            await _auditLog.LogAsync(
                request.ServerId,
                request.UserId,
                AuditLogActionTypes.CategoryCreate,
                AuditLogTargetTypes.Category,
                createdCategory.Id,
                new { targetName = createdCategory.CategoryName, isPrivate = true },
                cancellationToken);

            return new CreatePrivateCategoryResult
            {
                Success = true,
                Category = new
                {
                    categoryId = createdCategory.Id,
                    categoryName = createdCategory.CategoryName,
                    serverId = createdCategory.ServerId,
                    categoryOrder = createdCategory.CategoryOrder,
                    isPrivate = createdCategory.IsPrivate,
                    allowedRoleIds = createdCategory.AllowedRoleIds,
                    allowedUserIds = createdCategory.AllowedUserIds,
                    chats = new object[0]
                }
            };
        }
        catch (Exception ex)
        {
            return new CreatePrivateCategoryResult
            {
                Success = false,
                ErrorMessage = ex.Message
            };
        }
    }
}
