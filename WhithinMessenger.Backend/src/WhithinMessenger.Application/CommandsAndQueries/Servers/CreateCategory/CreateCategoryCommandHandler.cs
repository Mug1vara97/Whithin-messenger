using MediatR;
using WhithinMessenger.Domain.Interfaces;
using WhithinMessenger.Domain.Models;

namespace WhithinMessenger.Application.CommandsAndQueries.Servers;

public class CreateCategoryCommandHandler : IRequestHandler<CreateCategoryCommand, CreateCategoryResult>
{
    private readonly IServerRepository _serverRepository;
    private readonly ICategoryRepository _categoryRepository;

    public CreateCategoryCommandHandler(IServerRepository serverRepository, ICategoryRepository categoryRepository)
    {
        _serverRepository = serverRepository;
        _categoryRepository = categoryRepository;
    }

    public async Task<CreateCategoryResult> Handle(CreateCategoryCommand request, CancellationToken cancellationToken)
    {
        try
        {
            // Проверяем, что сервер существует и пользователь имеет доступ
            var server = await _serverRepository.GetByIdAsync(request.ServerId, cancellationToken);
            if (server == null)
            {
                return new CreateCategoryResult
                {
                    Success = false,
                    ErrorMessage = "Сервер не найден"
                };
            }

            if (!await _serverRepository.UserHasAccessAsync(request.ServerId, request.UserId, cancellationToken))
            {
                return new CreateCategoryResult
                {
                    Success = false,
                    ErrorMessage = "У вас нет доступа к этому серверу"
                };
            }

            // Проверяем, что категория с таким именем не существует
            if (await _categoryRepository.ExistsAsync(request.ServerId, request.CategoryName, cancellationToken))
            {
                return new CreateCategoryResult
                {
                    Success = false,
                    ErrorMessage = "Категория с таким именем уже существует"
                };
            }

            // Получаем следующий порядок категории
            var categories = await _categoryRepository.GetByServerIdAsync(request.ServerId, cancellationToken);
            var categoryOrder = categories.Count;

            // Создаем новую категорию
            var newCategory = new ChatCategory
            {
                Id = Guid.NewGuid(),
                CategoryName = request.CategoryName.Trim(),
                ServerId = request.ServerId,
                CategoryOrder = categoryOrder,
                IsPrivate = false
            };

            var createdCategory = await _categoryRepository.CreateAsync(newCategory, cancellationToken);

            return new CreateCategoryResult
            {
                Success = true,
                Category = new
                {
                    categoryId = createdCategory.Id,
                    categoryName = createdCategory.CategoryName,
                    serverId = createdCategory.ServerId,
                    categoryOrder = createdCategory.CategoryOrder,
                    isPrivate = createdCategory.IsPrivate,
                    chats = new object[0] // Пустой массив чатов
                }
            };
        }
        catch (Exception ex)
        {
            return new CreateCategoryResult
            {
                Success = false,
                ErrorMessage = ex.Message
            };
        }
    }
}
