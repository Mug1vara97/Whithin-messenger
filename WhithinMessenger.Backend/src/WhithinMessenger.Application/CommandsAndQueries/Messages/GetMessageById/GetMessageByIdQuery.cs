using MediatR;
using WhithinMessenger.Domain.Models;

namespace WhithinMessenger.Application.CommandsAndQueries.Messages.GetMessageById;

public record GetMessageByIdQuery(Guid MessageId) : IRequest<GetMessageByIdResult>;

public record GetMessageByIdResult
{
    public bool Success { get; init; }
    public Message? Message { get; init; }
    public string? ErrorMessage { get; init; }
}
























