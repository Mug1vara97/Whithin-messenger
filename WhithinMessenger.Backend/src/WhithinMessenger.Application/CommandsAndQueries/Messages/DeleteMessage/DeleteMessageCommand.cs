using MediatR;

namespace WhithinMessenger.Application.CommandsAndQueries.Messages.DeleteMessage;

public record DeleteMessageCommand(
    Guid MessageId,
    Guid UserId
) : IRequest<DeleteMessageResult>;

public record DeleteMessageResult
{
    public bool Success { get; init; }
    public string? ErrorMessage { get; init; }
}
























