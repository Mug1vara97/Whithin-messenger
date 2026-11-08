using MediatR;
using WhithinMessenger.Domain.Interfaces;

namespace WhithinMessenger.Application.CommandsAndQueries.Music.GetMusicLibrary;

public class GetMusicLibraryQueryHandler : IRequestHandler<GetMusicLibraryQuery, GetMusicLibraryResult>
{
    private readonly IUserMusicTrackRepository _repository;

    public GetMusicLibraryQueryHandler(IUserMusicTrackRepository repository)
    {
        _repository = repository;
    }

    public async Task<GetMusicLibraryResult> Handle(GetMusicLibraryQuery request, CancellationToken cancellationToken)
    {
        try
        {
            var tracks = await _repository.GetForUserAsync(request.UserId, cancellationToken);
            return new GetMusicLibraryResult
            {
                Success = true,
                Tracks = tracks.Select(UserMusicTrackMapper.ToDto).ToList()
            };
        }
        catch (Exception ex)
        {
            return new GetMusicLibraryResult { Success = false, ErrorMessage = ex.Message };
        }
    }
}
