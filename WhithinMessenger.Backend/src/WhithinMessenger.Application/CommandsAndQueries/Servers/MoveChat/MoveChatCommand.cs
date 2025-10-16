using MediatR;

namespace WhithinMessenger.Application.CommandsAndQueries.Servers;

public class MoveChatCommand : IRequest<MoveChatResult>
{
    public Guid ServerId { get; set; }
    public Guid ChatId { get; set; }
    public Guid? SourceCategoryId { get; set; }
    public Guid? TargetCategoryId { get; set; }
    public int NewPosition { get; set; }
    public Guid UserId { get; set; }

    public MoveChatCommand(Guid serverId, Guid chatId, Guid? sourceCategoryId, Guid? targetCategoryId, int newPosition, Guid userId)
    {
        ServerId = serverId;
        ChatId = chatId;
        SourceCategoryId = sourceCategoryId;
        TargetCategoryId = targetCategoryId;
        NewPosition = newPosition;
        UserId = userId;
    }
}

public class MoveChatResult
{
    public bool Success { get; set; }
    public string? ErrorMessage { get; set; }
    public object? Categories { get; set; }
}
























