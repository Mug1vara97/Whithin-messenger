using MediatR;
using Microsoft.AspNetCore.Http;

namespace WhithinMessenger.Application.CommandsAndQueries.Media.UploadMedia;

public record UploadMediaCommand(
    Guid UserId,
    Guid ChatId,
    IFormFile File,
    string? Caption = null,
    string? Username = null,
    bool IsVideoNote = false,
    double? DurationSeconds = null
) : IRequest<UploadMediaResult>;

public record UploadMediaResult
{
    public bool Success { get; init; }
    public Guid? MessageId { get; init; }
    public Guid? MediaFileId { get; init; }
    public string? FilePath { get; init; }
    public string? ThumbnailPath { get; init; }
    public bool IsVideoNote { get; init; }
    public double? DurationSeconds { get; init; }
    public string? StreamingManifestPath { get; init; }
    public string? ErrorMessage { get; init; }
}
