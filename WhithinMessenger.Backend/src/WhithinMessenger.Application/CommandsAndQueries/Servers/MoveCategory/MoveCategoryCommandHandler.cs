using MediatR;
using WhithinMessenger.Domain.Interfaces;
using WhithinMessenger.Domain.Models;

namespace WhithinMessenger.Application.CommandsAndQueries.Servers;

public class MoveCategoryCommandHandler : IRequestHandler<MoveCategoryCommand, MoveCategoryResult>
{
    private readonly IServerRepository _serverRepository;
    private readonly ICategoryRepository _categoryRepository;
    private readonly IChatRepository _chatRepository;

    public MoveCategoryCommandHandler(IServerRepository serverRepository, ICategoryRepository categoryRepository, IChatRepository chatRepository)
    {
        _serverRepository = serverRepository;
        _categoryRepository = categoryRepository;
        _chatRepository = chatRepository;
    }

    public async Task<MoveCategoryResult> Handle(MoveCategoryCommand request, CancellationToken cancellationToken)
    {
        try
        {
            // Получаем все категории сервера
            var categories = await _categoryRepository.GetByServerIdAsync(request.ServerId, cancellationToken);
            var orderedCategories = categories.OrderBy(c => c.CategoryOrder).ToList();

            // Находим категорию для перемещения
            var categoryToMove = orderedCategories.FirstOrDefault(c => c.Id == request.CategoryId);
            if (categoryToMove == null)
            {
                return new MoveCategoryResult
                {
                    Success = false,
                    ErrorMessage = "Категория не найдена"
                };
            }

            // Удаляем категорию из текущей позиции
            orderedCategories.Remove(categoryToMove);

            // Вставляем в новую позицию
            orderedCategories.Insert(request.NewPosition, categoryToMove);

            // Обновляем порядок всех категорий
            for (int i = 0; i < orderedCategories.Count; i++)
            {
                orderedCategories[i].CategoryOrder = i;
                await _categoryRepository.UpdateAsync(orderedCategories[i], cancellationToken);
            }

            // Получаем обновленные данные для отправки клиенту
            var updatedCategories = await _categoryRepository.GetByServerIdAsync(request.ServerId, cancellationToken);
            var chats = await _chatRepository.GetByServerIdAsync(request.ServerId, cancellationToken);

            // Формируем структуру данных для клиента
            var result = new List<object>();

            // Добавляем каналы без категории
            var uncategorizedChats = chats.Where(c => c.CategoryId == null).OrderBy(c => c.ChatOrder).ToList();
            if (uncategorizedChats.Any())
            {
                result.Add(new
                {
                    categoryId = (Guid?)null,
                    categoryName = (string?)null,
                    categoryOrder = -1,
                    isPrivate = false,
                    allowedRoleIds = (string?)null,
                    allowedUserIds = (string?)null,
                    chats = uncategorizedChats.Select(c => new
                    {
                        chatId = c.Id,
                        name = c.Name,
                        categoryId = c.CategoryId,
                        chatOrder = c.ChatOrder,
                        typeId = c.TypeId,
                        isPrivate = c.IsPrivate,
                        allowedRoleIds = c.AllowedRoleIds,
                        members = new List<object>()
                    })
                });
            }

            // Добавляем категории с их чатами
            foreach (var category in updatedCategories.OrderBy(c => c.CategoryOrder))
            {
                var categoryChats = chats.Where(c => c.CategoryId == category.Id).OrderBy(c => c.ChatOrder).ToList();
                result.Add(new
                {
                    categoryId = category.Id,
                    categoryName = category.CategoryName,
                    categoryOrder = category.CategoryOrder,
                    isPrivate = category.IsPrivate,
                    allowedRoleIds = category.AllowedRoleIds,
                    allowedUserIds = category.AllowedUserIds,
                    chats = categoryChats.Select(c => new
                    {
                        chatId = c.Id,
                        name = c.Name,
                        categoryId = c.CategoryId,
                        chatOrder = c.ChatOrder,
                        typeId = c.TypeId,
                        isPrivate = c.IsPrivate,
                        allowedRoleIds = c.AllowedRoleIds,
                        members = new List<object>()
                    })
                });
            }

            return new MoveCategoryResult
            {
                Success = true,
                Categories = result
            };
        }
        catch (Exception ex)
        {
            return new MoveCategoryResult
            {
                Success = false,
                ErrorMessage = $"Ошибка при перемещении категории: {ex.Message}"
            };
        }
    }
}
