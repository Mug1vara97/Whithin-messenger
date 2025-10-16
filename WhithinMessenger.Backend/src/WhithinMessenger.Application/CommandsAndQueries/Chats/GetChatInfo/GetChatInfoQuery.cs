using MediatR;
using WhithinMessenger.Application.DTOs;

namespace WhithinMessenger.Application.CommandsAndQueries.Chats.GetChatInfo;

public record GetChatInfoQuery(Guid ChatId, Guid UserId) : IRequest<GetChatInfoResult>;

public record GetChatInfoResult
{
    public bool Success { get; init; }
    public ChatInfoDto? ChatInfo { get; init; }
    public string? ErrorMessage { get; init; }
}

