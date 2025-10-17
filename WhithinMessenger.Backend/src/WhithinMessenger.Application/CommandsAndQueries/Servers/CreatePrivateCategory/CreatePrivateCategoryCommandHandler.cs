using MediatR;
using WhithinMessenger.Domain.Interfaces;
using WhithinMessenger.Domain.Models;
using System.Text.Json;

namespace WhithinMessenger.Application.CommandsAndQueries.Servers;

public class CreatePrivateCategoryCommandHandler : IRequestHandler<CreatePrivateCategoryCommand, CreatePrivateCategoryResult>
{
    private readonly IServerRepository _serverRepository;
    private readonly ICategoryRepository _categoryRepository;

    public CreatePrivateCategoryCommandHandler(IServerRepository serverRepository, ICategoryRepository categoryRepository)
    {
        _serverRepository = serverRepository;
        _categoryRepository = categoryRepository;
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
