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
            var chat = await _chatRepository.GetByIdAsync(request.ChatId, cancellationToken);
            if (chat == null)
            {
                return new MoveChatResult
                {
                    Success = false,
                    ErrorMessage = "Чат не найден"
                };
            }

            var originalChatOrder = chat.ChatOrder;
            
            chat.CategoryId = request.TargetCategoryId;
            chat.ChatOrder = request.NewPosition;

            var allServerChats = await _chatRepository.GetByServerIdAsync(request.ServerId, cancellationToken);
            
            if (request.SourceCategoryId == request.TargetCategoryId)
            {
                var categoryChats = allServerChats
                    .Where(c => c.CategoryId == request.TargetCategoryId && c.Id != request.ChatId)
                    .OrderBy(c => c.ChatOrder)
                    .ToList();
                
                var order = 0;
                foreach (var categoryChat in categoryChats)
                {
                    if (order == request.NewPosition)
                    {
                        order++;
                    }
                    categoryChat.ChatOrder = order++;
                    await _chatRepository.UpdateAsync(categoryChat, cancellationToken);
                }
            }
            else
            {
                if (request.SourceCategoryId.HasValue)
                {
                    var sourceCategoryChats = allServerChats.Where(c => c.CategoryId == request.SourceCategoryId.Value).ToList();
                    foreach (var sourceChat in sourceCategoryChats.Where(c => c.ChatOrder > chat.ChatOrder))
                    {
                        sourceChat.ChatOrder--;
                        await _chatRepository.UpdateAsync(sourceChat, cancellationToken);
                    }
                }
                
                var targetCategoryChats = allServerChats.Where(c => c.CategoryId == request.TargetCategoryId).ToList();
                foreach (var targetChat in targetCategoryChats.Where(c => c.ChatOrder >= request.NewPosition && c.Id != request.ChatId))
                {
                    targetChat.ChatOrder++;
                    await _chatRepository.UpdateAsync(targetChat, cancellationToken);
                }
            }

            await _chatRepository.UpdateAsync(chat, cancellationToken);

            var categories = await _categoryRepository.GetByServerIdAsync(request.ServerId, cancellationToken);
            var chats = await _chatRepository.GetByServerIdAsync(request.ServerId, cancellationToken);

            var result = new List<object>();

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
