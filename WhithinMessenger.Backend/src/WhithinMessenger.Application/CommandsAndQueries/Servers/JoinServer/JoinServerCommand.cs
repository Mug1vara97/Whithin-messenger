using MediatR;

namespace WhithinMessenger.Application.CommandsAndQueries.Servers;

public class JoinServerCommand : IRequest<JoinServerResult>
{
    public Guid ServerId { get; set; }
    public Guid UserId { get; set; }

    public JoinServerCommand(Guid serverId, Guid userId)
    {
        ServerId = serverId;
        UserId = userId;
    }
}

public class JoinServerResult
{
    public bool Success { get; set; }
    public string? ErrorMessage { get; set; }
}


















