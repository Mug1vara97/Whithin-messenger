using MediatR;
using WhithinMessenger.Domain.Interfaces;

namespace WhithinMessenger.Application.CommandsAndQueries.Stickers.InstallStickerPack;

public class InstallStickerPackCommandHandler : IRequestHandler<InstallStickerPackCommand, InstallStickerPackResult>
{
    private readonly IStickerPackRepository _stickerPackRepository;

    public InstallStickerPackCommandHandler(IStickerPackRepository stickerPackRepository)
    {
        _stickerPackRepository = stickerPackRepository;
    }

    public async Task<InstallStickerPackResult> Handle(InstallStickerPackCommand request, CancellationToken cancellationToken)
    {
        try
        {
            var installed = await _stickerPackRepository.InstallPackForUserAsync(
                request.UserId,
                request.PackId,
                cancellationToken);

            if (!installed)
            {
                return new InstallStickerPackResult
                {
                    Success = false,
                    ErrorMessage = "Стикерпак не найден"
                };
            }

            return new InstallStickerPackResult { Success = true };
        }
        catch (Exception ex)
        {
            return new InstallStickerPackResult
            {
                Success = false,
                ErrorMessage = ex.Message
            };
        }
    }
}
