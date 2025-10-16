using MediatR;
using WhithinMessenger.Domain.Models;

namespace WhithinMessenger.Application.CommandsAndQueries.Messages.SendMessage;

public record SendMessageCommand(
    Guid UserId,
    Guid ChatId,
    string Content,
    Guid? RepliedToMessageId = null,
    Guid? ForwardedFromMessageId = null
) : IRequest<SendMessageResult>;

public record SendMessageResult
{
    public bool Success { get; init; }
    public Guid? MessageId { get; init; }
    public string? ErrorMessage { get; init; }
}
























