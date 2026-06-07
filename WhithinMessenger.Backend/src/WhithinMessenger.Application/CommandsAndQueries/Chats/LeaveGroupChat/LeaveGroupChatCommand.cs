using MediatR;

namespace WhithinMessenger.Application.CommandsAndQueries.Chats.LeaveGroupChat;

public record LeaveGroupChatCommand(Guid ChatId, Guid UserId) : IRequest<LeaveGroupChatResult>;

public record LeaveGroupChatResult
{
    public bool Success { get; init; }
    public string? ErrorMessage { get; init; }
}
