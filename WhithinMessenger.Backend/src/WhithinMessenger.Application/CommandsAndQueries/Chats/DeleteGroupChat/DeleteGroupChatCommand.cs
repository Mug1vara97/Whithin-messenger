using MediatR;

namespace WhithinMessenger.Application.CommandsAndQueries.Chats.DeleteGroupChat;

public record DeleteGroupChatCommand(Guid ChatId, Guid UserId) : IRequest<DeleteGroupChatResult>;

public record DeleteGroupChatResult
{
    public bool Success { get; init; }
    public string? ErrorMessage { get; init; }
    public List<Guid> ParticipantIds { get; init; } = new();
}
