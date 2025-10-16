using MediatR;

namespace WhithinMessenger.Application.CommandsAndQueries.Media.GetMediaFiles;

public record GetMediaFilesQuery(
    Guid ChatId,
    string? MediaType = null,
    int Page = 1,
    int PageSize = 20
) : IRequest<GetMediaFilesResult>;

public record GetMediaFilesResult
{
    public List<MediaFileDto> MediaFiles { get; init; } = new();
    public int TotalCount { get; init; }
    public int Page { get; init; }
    public int PageSize { get; init; }
    public bool HasMore { get; init; }
}

public record MediaFileDto
{
    public Guid Id { get; init; }
    public string FileName { get; init; } = string.Empty;
    public string OriginalFileName { get; init; } = string.Empty;
    public string FilePath { get; init; } = string.Empty;
    public string ContentType { get; init; } = string.Empty;
    public long FileSize { get; init; }
    public string? ThumbnailPath { get; init; }
    public DateTimeOffset CreatedAt { get; init; }
    public string SenderUsername { get; init; } = string.Empty;
    public string? Caption { get; init; }
}
