using MediatR;

namespace WhithinMessenger.Application.CommandsAndQueries.Servers;

public class GetPublicServersQuery : IRequest<GetPublicServersResult>
{
    public GetPublicServersQuery()
    {
    }
}

public class GetPublicServersResult
{
    public bool Success { get; set; }
    public string? ErrorMessage { get; set; }
    public List<object> Servers { get; set; } = new();
}


















