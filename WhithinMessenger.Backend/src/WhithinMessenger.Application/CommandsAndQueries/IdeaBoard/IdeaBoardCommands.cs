using MediatR;

namespace WhithinMessenger.Application.CommandsAndQueries.IdeaBoard;

public class GetIdeaBoardCardsQuery : IRequest<GetIdeaBoardCardsResult>
{
    public Guid ChatId { get; }
    public Guid UserId { get; }

    public GetIdeaBoardCardsQuery(Guid chatId, Guid userId)
    {
        ChatId = chatId;
        UserId = userId;
    }
}

public class GetIdeaBoardCardsResult
{
    public bool Success { get; set; }
    public string? ErrorMessage { get; set; }
    public Guid? ServerId { get; set; }
    public object? Cards { get; set; }
}

public class CreateIdeaBoardCardCommand : IRequest<IdeaBoardCardMutationResult>
{
    public Guid ChatId { get; }
    public Guid UserId { get; }
    public string Title { get; }
    public string Body { get; }
    public string? Tag { get; }
    public string? SourceUrl { get; }

    public CreateIdeaBoardCardCommand(
        Guid chatId,
        Guid userId,
        string title,
        string body,
        string? tag,
        string? sourceUrl)
    {
        ChatId = chatId;
        UserId = userId;
        Title = title;
        Body = body;
        Tag = tag;
        SourceUrl = sourceUrl;
    }
}

public class UpdateIdeaBoardCardCommand : IRequest<IdeaBoardCardMutationResult>
{
    public Guid CardId { get; }
    public Guid UserId { get; }
    public string Title { get; }
    public string Body { get; }
    public string? Tag { get; }
    public string? SourceUrl { get; }
    public bool? IsFiled { get; }

    public UpdateIdeaBoardCardCommand(
        Guid cardId,
        Guid userId,
        string title,
        string body,
        string? tag,
        string? sourceUrl,
        bool? isFiled)
    {
        CardId = cardId;
        UserId = userId;
        Title = title;
        Body = body;
        Tag = tag;
        SourceUrl = sourceUrl;
        IsFiled = isFiled;
    }
}

public class UpdateIdeaBoardCardPositionCommand : IRequest<IdeaBoardCardMutationResult>
{
    public Guid CardId { get; }
    public Guid UserId { get; }
    public double PositionX { get; }
    public double PositionY { get; }
    public double Rotation { get; }

    public UpdateIdeaBoardCardPositionCommand(
        Guid cardId,
        Guid userId,
        double positionX,
        double positionY,
        double rotation)
    {
        CardId = cardId;
        UserId = userId;
        PositionX = positionX;
        PositionY = positionY;
        Rotation = rotation;
    }
}

public class DeleteIdeaBoardCardCommand : IRequest<IdeaBoardCardMutationResult>
{
    public Guid CardId { get; }
    public Guid UserId { get; }

    public DeleteIdeaBoardCardCommand(Guid cardId, Guid userId)
    {
        CardId = cardId;
        UserId = userId;
    }
}

public class IdeaBoardCardMutationResult
{
    public bool Success { get; set; }
    public string? ErrorMessage { get; set; }
    public Guid? ServerId { get; set; }
    public object? Card { get; set; }
}
