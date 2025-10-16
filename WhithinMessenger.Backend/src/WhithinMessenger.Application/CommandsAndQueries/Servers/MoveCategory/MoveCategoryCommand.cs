using MediatR;

namespace WhithinMessenger.Application.CommandsAndQueries.Servers;

public class MoveCategoryCommand : IRequest<MoveCategoryResult>
{
    public Guid ServerId { get; set; }
    public Guid CategoryId { get; set; }
    public int NewPosition { get; set; }
    public Guid UserId { get; set; }

    public MoveCategoryCommand(Guid serverId, Guid categoryId, int newPosition, Guid userId)
    {
        ServerId = serverId;
        CategoryId = categoryId;
        NewPosition = newPosition;
        UserId = userId;
    }
}

public class MoveCategoryResult
{
    public bool Success { get; set; }
    public string? ErrorMessage { get; set; }
    public object? Categories { get; set; }
}
























