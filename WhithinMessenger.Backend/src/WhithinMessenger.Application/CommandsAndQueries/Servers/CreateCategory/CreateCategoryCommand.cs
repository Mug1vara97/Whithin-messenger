using MediatR;

namespace WhithinMessenger.Application.CommandsAndQueries.Servers;

public class CreateCategoryCommand : IRequest<CreateCategoryResult>
{
    public Guid ServerId { get; set; }
    public string CategoryName { get; set; }
    public Guid UserId { get; set; }

    public CreateCategoryCommand(Guid serverId, string categoryName, Guid userId)
    {
        ServerId = serverId;
        CategoryName = categoryName;
        UserId = userId;
    }
}

public class CreateCategoryResult
{
    public bool Success { get; set; }
    public string? ErrorMessage { get; set; }
    public object? Category { get; set; }
}
























