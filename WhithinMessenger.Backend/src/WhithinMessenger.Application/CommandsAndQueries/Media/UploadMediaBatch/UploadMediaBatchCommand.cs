using MediatR;
using Microsoft.AspNetCore.Http;

namespace WhithinMessenger.Application.CommandsAndQueries.Media.UploadMediaBatch;

public record UploadMediaBatchCommand(
    Guid UserId,
    Guid ChatId,
    IReadOnlyList<IFormFile> Files,
    string? Caption = null,
    string? Username = null
) : IRequest<UploadMediaBatchResult>;

public record UploadMediaBatchMediaItem
{
    public Guid MediaFileId { get; init; }
    public string FilePath { get; init; } = string.Empty;
    public string? ThumbnailPath { get; init; }
    public string ContentType { get; init; } = string.Empty;
    public string OriginalFileName { get; init; } = string.Empty;
    public long FileSize { get; init; }
    public bool IsVideoNote { get; init; }
}

public record UploadMediaBatchResult
{
    public bool Success { get; init; }
    public Guid? MessageId { get; init; }
    public IReadOnlyList<UploadMediaBatchMediaItem> MediaItems { get; init; } = Array.Empty<UploadMediaBatchMediaItem>();
    public string? ErrorMessage { get; init; }
}
