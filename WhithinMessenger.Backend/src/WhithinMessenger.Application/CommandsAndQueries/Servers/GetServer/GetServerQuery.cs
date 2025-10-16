using MediatR;

namespace WhithinMessenger.Application.CommandsAndQueries.Servers;

public class GetServerQuery : IRequest<GetServerResult>
{
    public Guid ServerId { get; set; }
    public Guid UserId { get; set; }

    public GetServerQuery(Guid serverId, Guid userId)
    {
        ServerId = serverId;
        UserId = userId;
    }
}

public class GetServerResult
{
    public bool Success { get; set; }
    public string? ErrorMessage { get; set; }
    public object? Server { get; set; }
}
























