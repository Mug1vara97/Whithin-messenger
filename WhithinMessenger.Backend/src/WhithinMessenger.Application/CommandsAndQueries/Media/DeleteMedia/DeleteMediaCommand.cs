using MediatR;

namespace WhithinMessenger.Application.CommandsAndQueries.Media.DeleteMedia;

public record DeleteMediaCommand(
    Guid UserId,
    Guid MediaFileId
) : IRequest<DeleteMediaResult>;

public record DeleteMediaResult
{
    public bool Success { get; init; }
    public string? ErrorMessage { get; init; }
}















