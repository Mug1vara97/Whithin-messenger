using MediatR;

namespace WhithinMessenger.Application.CommandsAndQueries.Servers;

public class GetUserServersQuery : IRequest<GetUserServersResult>
{
    public Guid UserId { get; set; }

    public GetUserServersQuery(Guid userId)
    {
        UserId = userId;
    }
}

public class GetUserServersResult
{
    public bool Success { get; set; }
    public string? ErrorMessage { get; set; }
    public List<object>? Servers { get; set; }
}
























