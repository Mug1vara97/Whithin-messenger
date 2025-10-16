using MediatR;
using Microsoft.AspNetCore.Http;

namespace WhithinMessenger.Application.CommandsAndQueries.Chats.UploadChatAvatar;

public record UploadChatAvatarCommand(
    Guid ChatId,
    Guid UserId,
    IFormFile File
) : IRequest<UploadChatAvatarResult>;

public record UploadChatAvatarResult
{
    public bool Success { get; init; }
    public string? AvatarUrl { get; init; }
    public string? ErrorMessage { get; init; }
}

