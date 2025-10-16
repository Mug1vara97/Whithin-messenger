using MediatR;
using WhithinMessenger.Domain.Interfaces;
using WhithinMessenger.Domain.Models;

namespace WhithinMessenger.Application.CommandsAndQueries.Servers;

public class MoveChatCommandHandler : IRequestHandler<MoveChatCommand, MoveChatResult>
{
    private readonly IChatRepository _chatRepository;
    private readonly ICategoryRepository _categoryRepository;

    public MoveChatCommandHandler(IChatRepository chatRepository, ICategoryRepository categoryRepository)
    {
        _chatRepository = chatRepository;
        _categoryRepository = categoryRepository;
    }

    public async Task<MoveChatResult> Handle(MoveChatCommand request, CancellationToken cancellationToken)
    {
        try
        {
            // Получаем чат для перемещения
            var chat = await _chatRepository.GetByIdAsync(request.ChatId, cancellationToken);
            if (chat == null)
            {
                return new MoveChatResult
                {
                    Success = false,
                    ErrorMessage = "Чат не найден"
                };
            }

            // Сохраняем исходный порядок чата для логики переупорядочивания
            var originalChatOrder = chat.ChatOrder;
            
            // Обновляем категорию и порядок чата
            chat.CategoryId = request.TargetCategoryId;
            chat.ChatOrder = request.NewPosition;

            // Получаем все чаты сервера для работы с порядком
            var allServerChats = await _chatRepository.GetByServerIdAsync(request.ServerId, cancellationToken);
            
            // Если чат перемещается в той же категории, пересчитываем все порядки
            if (request.SourceCategoryId == request.TargetCategoryId)
            {
                // Получаем все чаты в этой категории (кроме перемещаемого)
                var categoryChats = allServerChats
                    .Where(c => c.CategoryId == request.TargetCategoryId && c.Id != request.ChatId)
                    .OrderBy(c => c.ChatOrder)
                    .ToList();
                
                // Пересчитываем порядки для всех чатов в категории
                var order = 0;
                foreach (var categoryChat in categoryChats)
                {
                    if (order == request.NewPosition)
                    {
                        order++; // Пропускаем позицию для перемещаемого чата
                    }
                    categoryChat.ChatOrder = order++;
                    await _chatRepository.UpdateAsync(categoryChat, cancellationToken);
                }
            }
            else
            {
                // Если чат перемещается в другую категорию, обновляем порядок в исходной категории
                if (request.SourceCategoryId.HasValue)
                {
                    var sourceCategoryChats = allServerChats.Where(c => c.CategoryId == request.SourceCategoryId.Value).ToList();
                    foreach (var sourceChat in sourceCategoryChats.Where(c => c.ChatOrder > chat.ChatOrder))
                    {
                        sourceChat.ChatOrder--;
                        await _chatRepository.UpdateAsync(sourceChat, cancellationToken);
                    }
                }
                
                // Обновляем порядок в целевой категории
                var targetCategoryChats = allServerChats.Where(c => c.CategoryId == request.TargetCategoryId).ToList();
                foreach (var targetChat in targetCategoryChats.Where(c => c.ChatOrder >= request.NewPosition && c.Id != request.ChatId))
                {
                    targetChat.ChatOrder++;
                    await _chatRepository.UpdateAsync(targetChat, cancellationToken);
                }
            }

            // Сохраняем изменения перемещаемого чата
            await _chatRepository.UpdateAsync(chat, cancellationToken);

            // Получаем обновленные категории для отправки клиенту
            var categories = await _categoryRepository.GetByServerIdAsync(request.ServerId, cancellationToken);
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
            foreach (var category in categories.OrderBy(c => c.CategoryOrder))
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

            return new MoveChatResult
            {
                Success = true,
                Categories = result
            };
        }
        catch (Exception ex)
        {
            return new MoveChatResult
            {
                Success = false,
                ErrorMessage = $"Ошибка при перемещении чата: {ex.Message}"
            };
        }
    }
}
