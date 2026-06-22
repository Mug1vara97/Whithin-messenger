using MediatR;
using WhithinMessenger.Application.Services;
using WhithinMessenger.Domain.Interfaces;
using WhithinMessenger.Domain.Models;

namespace WhithinMessenger.Application.CommandsAndQueries.IdeaBoard;

public static class IdeaBoardType
{
    public static readonly Guid TypeId = ChatTypeIds.IdeasBoard;
}

public static class IdeaBoardCardMapper
{
    public static object Map(IdeaBoardCard card) => new
    {
        cardId = card.Id,
        chatId = card.ChatId,
        authorUserId = card.AuthorUserId,
        authorUsername = card.Author?.UserName ?? string.Empty,
        title = card.Title,
        body = card.Body,
        tag = card.Tag,
        sourceUrl = card.SourceUrl,
        positionX = card.PositionX,
        positionY = card.PositionY,
        rotation = card.Rotation,
        isFiled = card.IsFiled,
        createdAt = card.CreatedAt,
        updatedAt = card.UpdatedAt,
    };
}

public class IdeaBoardAccessHelper
{
    private readonly IChatRepository _chatRepository;
    private readonly ServerPermissionChecker _permissionChecker;

    public IdeaBoardAccessHelper(IChatRepository chatRepository, ServerPermissionChecker permissionChecker)
    {
        _chatRepository = chatRepository;
        _permissionChecker = permissionChecker;
    }

    public async Task<(Chat Chat, Guid ServerId)?> ValidateIdeasBoardAccessAsync(
        Guid chatId,
        Guid userId,
        bool requireSendPermission,
        CancellationToken cancellationToken)
    {
        var chat = await _chatRepository.GetByIdAsync(chatId, cancellationToken);
        if (chat == null || !chat.ServerId.HasValue || chat.TypeId != IdeaBoardType.TypeId)
        {
            return null;
        }

        var permission = requireSendPermission ? "sendMessages" : "viewChannels";
        if (!await _permissionChecker.HasPermissionAsync(
                chat.ServerId.Value, userId, permission, cancellationToken))
        {
            return null;
        }

        return (chat, chat.ServerId.Value);
    }

    public async Task<bool> CanModifyCardAsync(
        Guid serverId,
        Guid userId,
        IdeaBoardCard card,
        CancellationToken cancellationToken)
    {
        if (card.AuthorUserId == userId)
        {
            return true;
        }

        if (await _permissionChecker.IsOwnerAsync(serverId, userId, cancellationToken))
        {
            return true;
        }

        return await _permissionChecker.HasPermissionAsync(
            serverId, userId, "manageMessages", cancellationToken);
    }
}

public class GetIdeaBoardCardsQueryHandler : IRequestHandler<GetIdeaBoardCardsQuery, GetIdeaBoardCardsResult>
{
    private readonly IIdeaBoardRepository _ideaBoardRepository;
    private readonly IdeaBoardAccessHelper _accessHelper;

    public GetIdeaBoardCardsQueryHandler(IIdeaBoardRepository ideaBoardRepository, IdeaBoardAccessHelper accessHelper)
    {
        _ideaBoardRepository = ideaBoardRepository;
        _accessHelper = accessHelper;
    }

    public async Task<GetIdeaBoardCardsResult> Handle(GetIdeaBoardCardsQuery request, CancellationToken cancellationToken)
    {
        var access = await _accessHelper.ValidateIdeasBoardAccessAsync(
            request.ChatId, request.UserId, requireSendPermission: false, cancellationToken);
        if (access == null)
        {
            return new GetIdeaBoardCardsResult
            {
                Success = false,
                ErrorMessage = "Нет доступа к доске идей",
            };
        }

        var cards = await _ideaBoardRepository.GetByChatIdAsync(request.ChatId, cancellationToken);
        return new GetIdeaBoardCardsResult
        {
            Success = true,
            ServerId = access.Value.ServerId,
            Cards = cards.Select(IdeaBoardCardMapper.Map).ToList(),
        };
    }
}

public class CreateIdeaBoardCardCommandHandler : IRequestHandler<CreateIdeaBoardCardCommand, IdeaBoardCardMutationResult>
{
    private readonly IIdeaBoardRepository _ideaBoardRepository;
    private readonly IdeaBoardAccessHelper _accessHelper;

    public CreateIdeaBoardCardCommandHandler(IIdeaBoardRepository ideaBoardRepository, IdeaBoardAccessHelper accessHelper)
    {
        _ideaBoardRepository = ideaBoardRepository;
        _accessHelper = accessHelper;
    }

    public async Task<IdeaBoardCardMutationResult> Handle(CreateIdeaBoardCardCommand request, CancellationToken cancellationToken)
    {
        var access = await _accessHelper.ValidateIdeasBoardAccessAsync(
            request.ChatId, request.UserId, requireSendPermission: true, cancellationToken);
        if (access == null)
        {
            return new IdeaBoardCardMutationResult
            {
                Success = false,
                ErrorMessage = "Недостаточно прав для добавления идеи",
            };
        }

        var title = request.Title?.Trim() ?? string.Empty;
        if (title.Length == 0)
        {
            return new IdeaBoardCardMutationResult
            {
                Success = false,
                ErrorMessage = "Укажите заголовок идеи",
            };
        }

        var card = new IdeaBoardCard
        {
            Id = Guid.NewGuid(),
            ChatId = request.ChatId,
            AuthorUserId = request.UserId,
            Title = title,
            Body = request.Body?.Trim() ?? string.Empty,
            Tag = string.IsNullOrWhiteSpace(request.Tag) ? null : request.Tag.Trim(),
            SourceUrl = string.IsNullOrWhiteSpace(request.SourceUrl) ? null : request.SourceUrl.Trim(),
            Rotation = Random.Shared.Next(-4, 5),
            CreatedAt = DateTimeOffset.UtcNow,
        };

        await _ideaBoardRepository.CreateAsync(card, cancellationToken);
        var saved = await _ideaBoardRepository.GetByIdAsync(card.Id, cancellationToken);

        return new IdeaBoardCardMutationResult
        {
            Success = true,
            ServerId = access.Value.ServerId,
            Card = saved == null ? IdeaBoardCardMapper.Map(card) : IdeaBoardCardMapper.Map(saved),
        };
    }
}

public class UpdateIdeaBoardCardCommandHandler : IRequestHandler<UpdateIdeaBoardCardCommand, IdeaBoardCardMutationResult>
{
    private readonly IIdeaBoardRepository _ideaBoardRepository;
    private readonly IdeaBoardAccessHelper _accessHelper;

    public UpdateIdeaBoardCardCommandHandler(IIdeaBoardRepository ideaBoardRepository, IdeaBoardAccessHelper accessHelper)
    {
        _ideaBoardRepository = ideaBoardRepository;
        _accessHelper = accessHelper;
    }

    public async Task<IdeaBoardCardMutationResult> Handle(UpdateIdeaBoardCardCommand request, CancellationToken cancellationToken)
    {
        var card = await _ideaBoardRepository.GetByIdAsync(request.CardId, cancellationToken);
        if (card == null)
        {
            return new IdeaBoardCardMutationResult { Success = false, ErrorMessage = "Идея не найдена" };
        }

        var access = await _accessHelper.ValidateIdeasBoardAccessAsync(
            card.ChatId, request.UserId, requireSendPermission: false, cancellationToken);
        if (access == null)
        {
            return new IdeaBoardCardMutationResult
            {
                Success = false,
                ErrorMessage = "Недостаточно прав для изменения идеи",
            };
        }

        if (!await _accessHelper.CanModifyCardAsync(
                access.Value.ServerId, request.UserId, card, cancellationToken))
        {
            return new IdeaBoardCardMutationResult
            {
                Success = false,
                ErrorMessage = "Редактировать идею может только автор или администратор",
            };
        }

        card.Title = request.Title?.Trim() ?? card.Title;
        card.Body = request.Body?.Trim() ?? card.Body;
        card.Tag = string.IsNullOrWhiteSpace(request.Tag) ? null : request.Tag.Trim();
        card.SourceUrl = string.IsNullOrWhiteSpace(request.SourceUrl) ? null : request.SourceUrl.Trim();
        if (request.IsFiled.HasValue)
        {
            card.IsFiled = request.IsFiled.Value;
        }
        card.UpdatedAt = DateTimeOffset.UtcNow;

        await _ideaBoardRepository.UpdateAsync(card, cancellationToken);
        var saved = await _ideaBoardRepository.GetByIdAsync(card.Id, cancellationToken);

        return new IdeaBoardCardMutationResult
        {
            Success = true,
            ServerId = access.Value.ServerId,
            Card = saved == null ? IdeaBoardCardMapper.Map(card) : IdeaBoardCardMapper.Map(saved),
        };
    }
}

public class UpdateIdeaBoardCardPositionCommandHandler
    : IRequestHandler<UpdateIdeaBoardCardPositionCommand, IdeaBoardCardMutationResult>
{
    private readonly IIdeaBoardRepository _ideaBoardRepository;
    private readonly IdeaBoardAccessHelper _accessHelper;

    public UpdateIdeaBoardCardPositionCommandHandler(
        IIdeaBoardRepository ideaBoardRepository,
        IdeaBoardAccessHelper accessHelper)
    {
        _ideaBoardRepository = ideaBoardRepository;
        _accessHelper = accessHelper;
    }

    public async Task<IdeaBoardCardMutationResult> Handle(
        UpdateIdeaBoardCardPositionCommand request,
        CancellationToken cancellationToken)
    {
        var card = await _ideaBoardRepository.GetByIdAsync(request.CardId, cancellationToken);
        if (card == null)
        {
            return new IdeaBoardCardMutationResult { Success = false, ErrorMessage = "Идея не найдена" };
        }

        var access = await _accessHelper.ValidateIdeasBoardAccessAsync(
            card.ChatId, request.UserId, requireSendPermission: false, cancellationToken);
        if (access == null)
        {
            return new IdeaBoardCardMutationResult
            {
                Success = false,
                ErrorMessage = "Недостаточно прав для перемещения идеи",
            };
        }

        if (!await _accessHelper.CanModifyCardAsync(
                access.Value.ServerId, request.UserId, card, cancellationToken))
        {
            return new IdeaBoardCardMutationResult
            {
                Success = false,
                ErrorMessage = "Перемещать идею может только автор или администратор",
            };
        }

        card.PositionX = request.PositionX;
        card.PositionY = request.PositionY;
        card.Rotation = request.Rotation;
        card.UpdatedAt = DateTimeOffset.UtcNow;

        await _ideaBoardRepository.UpdateAsync(card, cancellationToken);
        var saved = await _ideaBoardRepository.GetByIdAsync(card.Id, cancellationToken);

        return new IdeaBoardCardMutationResult
        {
            Success = true,
            ServerId = access.Value.ServerId,
            Card = saved == null ? IdeaBoardCardMapper.Map(card) : IdeaBoardCardMapper.Map(saved),
        };
    }
}

public class DeleteIdeaBoardCardCommandHandler : IRequestHandler<DeleteIdeaBoardCardCommand, IdeaBoardCardMutationResult>
{
    private readonly IIdeaBoardRepository _ideaBoardRepository;
    private readonly IdeaBoardAccessHelper _accessHelper;

    public DeleteIdeaBoardCardCommandHandler(IIdeaBoardRepository ideaBoardRepository, IdeaBoardAccessHelper accessHelper)
    {
        _ideaBoardRepository = ideaBoardRepository;
        _accessHelper = accessHelper;
    }

    public async Task<IdeaBoardCardMutationResult> Handle(DeleteIdeaBoardCardCommand request, CancellationToken cancellationToken)
    {
        var card = await _ideaBoardRepository.GetByIdAsync(request.CardId, cancellationToken);
        if (card == null)
        {
            return new IdeaBoardCardMutationResult { Success = false, ErrorMessage = "Идея не найдена" };
        }

        var access = await _accessHelper.ValidateIdeasBoardAccessAsync(
            card.ChatId, request.UserId, requireSendPermission: false, cancellationToken);
        if (access == null)
        {
            return new IdeaBoardCardMutationResult
            {
                Success = false,
                ErrorMessage = "Недостаточно прав для удаления идеи",
            };
        }

        if (!await _accessHelper.CanModifyCardAsync(
                access.Value.ServerId, request.UserId, card, cancellationToken))
        {
            return new IdeaBoardCardMutationResult
            {
                Success = false,
                ErrorMessage = "Удалить идею может только автор или администратор",
            };
        }

        var chatId = card.ChatId;
        await _ideaBoardRepository.DeleteAsync(request.CardId, cancellationToken);

        return new IdeaBoardCardMutationResult
        {
            Success = true,
            ServerId = access.Value.ServerId,
            Card = new { cardId = request.CardId, chatId },
        };
    }
}
