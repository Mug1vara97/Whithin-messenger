using System.Text.RegularExpressions;
using MediatR;
using WhithinMessenger.Domain.Interfaces;
using WhithinMessenger.Domain.Models;

namespace WhithinMessenger.Application.CommandsAndQueries.Music.AddMusicTrack;

public class AddMusicTrackCommandHandler : IRequestHandler<AddMusicTrackCommand, AddMusicTrackResult>
{
    private static readonly Regex VideoIdPattern = new("^[A-Za-z0-9_-]{6,32}$", RegexOptions.Compiled);

    private readonly IUserMusicTrackRepository _repository;

    public AddMusicTrackCommandHandler(IUserMusicTrackRepository repository)
    {
        _repository = repository;
    }

    public async Task<AddMusicTrackResult> Handle(AddMusicTrackCommand request, CancellationToken cancellationToken)
    {
        var videoId = request.VideoId?.Trim() ?? string.Empty;
        if (!VideoIdPattern.IsMatch(videoId))
        {
            return new AddMusicTrackResult { Success = false, ErrorMessage = "Некорректный videoId" };
        }

        var title = Truncate(request.Title?.Trim(), 500);
        if (string.IsNullOrEmpty(title))
        {
            return new AddMusicTrackResult { Success = false, ErrorMessage = "Название трека обязательно" };
        }

        try
        {
            var saved = await _repository.AddAsync(new UserMusicTrack
            {
                Id = Guid.NewGuid(),
                UserId = request.UserId,
                VideoId = videoId,
                Title = title,
                Artist = Truncate(request.Artist?.Trim(), 300) ?? string.Empty,
                DurationSeconds = Math.Max(0, request.DurationSeconds),
                ThumbnailUrl = Truncate(request.ThumbnailUrl?.Trim(), 1000),
                AddedAt = DateTimeOffset.UtcNow
            }, cancellationToken);

            return new AddMusicTrackResult { Success = true, Track = UserMusicTrackMapper.ToDto(saved) };
        }
        catch (Exception ex)
        {
            return new AddMusicTrackResult { Success = false, ErrorMessage = ex.Message };
        }
    }

    private static string? Truncate(string? value, int max) =>
        string.IsNullOrEmpty(value) ? value : value.Length <= max ? value : value[..max];
}
