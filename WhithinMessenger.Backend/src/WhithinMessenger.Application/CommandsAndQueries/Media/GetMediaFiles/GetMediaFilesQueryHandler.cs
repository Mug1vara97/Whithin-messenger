using MediatR;
using WhithinMessenger.Domain.Interfaces;
using WhithinMessenger.Application.CommandsAndQueries.Media.GetMediaFiles;

namespace WhithinMessenger.Application.CommandsAndQueries.Media.GetMediaFiles;

public class GetMediaFilesQueryHandler : IRequestHandler<GetMediaFilesQuery, GetMediaFilesResult>
{
    private readonly IMediaFileRepository _mediaFileRepository;

    public GetMediaFilesQueryHandler(IMediaFileRepository mediaFileRepository)
    {
        _mediaFileRepository = mediaFileRepository;
    }

    public async Task<GetMediaFilesResult> Handle(GetMediaFilesQuery request, CancellationToken cancellationToken)
    {
        var mediaFiles = await _mediaFileRepository.GetByChatIdAsync(request.ChatId, cancellationToken);
        
        // Фильтрация по типу медиафайла
        if (!string.IsNullOrEmpty(request.MediaType))
        {
            mediaFiles = request.MediaType.ToLower() switch
            {
                "image" => mediaFiles.Where(mf => mf.ContentType.StartsWith("image/")).ToList(),
                "video" => mediaFiles.Where(mf => mf.ContentType.StartsWith("video/")).ToList(),
                "audio" => mediaFiles.Where(mf => mf.ContentType.StartsWith("audio/")).ToList(),
                _ => mediaFiles
            };
        }

        var totalCount = mediaFiles.Count;
        var pagedFiles = mediaFiles
            .OrderByDescending(mf => mf.CreatedAt)
            .Skip((request.Page - 1) * request.PageSize)
            .Take(request.PageSize)
            .Select(mf => new MediaFileDto
            {
                Id = mf.Id,
                FileName = mf.FileName,
                OriginalFileName = mf.OriginalFileName,
                FilePath = mf.FilePath,
                ContentType = mf.ContentType,
                FileSize = mf.FileSize,
                ThumbnailPath = mf.ThumbnailPath,
                CreatedAt = mf.CreatedAt,
                SenderUsername = mf.Message.User.UserName ?? "Unknown",
                Caption = mf.Message.Content
            })
            .ToList();

        return new GetMediaFilesResult
        {
            MediaFiles = pagedFiles,
            TotalCount = totalCount,
            Page = request.Page,
            PageSize = request.PageSize,
            HasMore = (request.Page * request.PageSize) < totalCount
        };
    }
}
