using MediatR;

namespace WhithinMessenger.Application.CommandsAndQueries.Servers;

public class CreateServerCommand : IRequest<CreateServerResult>
{
    public string ServerName { get; set; }
    public Guid OwnerId { get; set; }
    public bool IsPublic { get; set; }
    public string? Description { get; set; }

    public CreateServerCommand(string serverName, Guid ownerId, bool isPublic = false, string? description = null)
    {
        ServerName = serverName;
        OwnerId = ownerId;
        IsPublic = isPublic;
        Description = description;
    }
}

public class CreateServerResult
{
    public bool Success { get; set; }
    public string? ErrorMessage { get; set; }
    public object? Server { get; set; }
}
























