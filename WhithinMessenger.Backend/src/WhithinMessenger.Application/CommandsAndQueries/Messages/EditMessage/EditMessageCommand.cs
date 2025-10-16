using MediatR;

namespace WhithinMessenger.Application.CommandsAndQueries.Messages.EditMessage;

public record EditMessageCommand(
    Guid MessageId,
    Guid UserId,
    string NewContent
) : IRequest<EditMessageResult>;

public record EditMessageResult
{
    public bool Success { get; init; }
    public string? ErrorMessage { get; init; }
}
























