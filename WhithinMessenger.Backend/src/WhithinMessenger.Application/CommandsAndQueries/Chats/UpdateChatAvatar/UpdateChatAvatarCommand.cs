using MediatR;

namespace WhithinMessenger.Application.CommandsAndQueries.Chats.UpdateChatAvatar;

public record UpdateChatAvatarCommand(Guid ChatId, Guid UserId, string AvatarUrl) : IRequest<UpdateChatAvatarResult>;

public record UpdateChatAvatarResult
{
    public bool Success { get; init; }
    public string? ErrorMessage { get; init; }
}









