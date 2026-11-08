using MediatR;
using WhithinMessenger.Domain.Interfaces;

namespace WhithinMessenger.Application.CommandsAndQueries.Music.RemoveMusicTrack;

public class RemoveMusicTrackCommandHandler : IRequestHandler<RemoveMusicTrackCommand, RemoveMusicTrackResult>
{
    private readonly IUserMusicTrackRepository _repository;

    public RemoveMusicTrackCommandHandler(IUserMusicTrackRepository repository)
    {
        _repository = repository;
    }

    public async Task<RemoveMusicTrackResult> Handle(RemoveMusicTrackCommand request, CancellationToken cancellationToken)
    {
        try
        {
            // Removing a track that is already gone is not an error for the client.
            await _repository.RemoveAsync(request.UserId, request.VideoId.Trim(), cancellationToken);
            return new RemoveMusicTrackResult { Success = true };
        }
        catch (Exception ex)
        {
            return new RemoveMusicTrackResult { Success = false, ErrorMessage = ex.Message };
        }
    }
}
