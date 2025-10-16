using MediatR;

namespace WhithinMessenger.Application.CommandsAndQueries.Servers;

public class CreatePrivateCategoryCommand : IRequest<CreatePrivateCategoryResult>
{
    public Guid ServerId { get; set; }
    public string CategoryName { get; set; }
    public List<Guid> AllowedRoleIds { get; set; }
    public List<Guid> AllowedUserIds { get; set; }
    public Guid UserId { get; set; }

    public CreatePrivateCategoryCommand(Guid serverId, string categoryName, List<Guid> allowedRoleIds, List<Guid> allowedUserIds, Guid userId)
    {
        ServerId = serverId;
        CategoryName = categoryName;
        AllowedRoleIds = allowedRoleIds;
        AllowedUserIds = allowedUserIds;
        UserId = userId;
    }
}

public class CreatePrivateCategoryResult
{
    public bool Success { get; set; }
    public string? ErrorMessage { get; set; }
    public object? Category { get; set; }
}
























