using MediatR;
using WhithinMessenger.Domain.Interfaces;

namespace WhithinMessenger.Application.CommandsAndQueries.Stickers.UninstallStickerPack;

public class UninstallStickerPackCommandHandler : IRequestHandler<UninstallStickerPackCommand, UninstallStickerPackResult>
{
    private readonly IStickerPackRepository _stickerPackRepository;

    public UninstallStickerPackCommandHandler(IStickerPackRepository stickerPackRepository)
    {
        _stickerPackRepository = stickerPackRepository;
    }

    public async Task<UninstallStickerPackResult> Handle(UninstallStickerPackCommand request, CancellationToken cancellationToken)
    {
        try
        {
            var uninstalled = await _stickerPackRepository.UninstallPackForUserAsync(
                request.UserId,
                request.PackId,
                cancellationToken);

            if (!uninstalled)
            {
                return new UninstallStickerPackResult
                {
                    Success = false,
                    ErrorMessage = "Стикерпак не найден в вашем списке",
                };
            }

            return new UninstallStickerPackResult { Success = true };
        }
        catch (Exception ex)
        {
            return new UninstallStickerPackResult
            {
                Success = false,
                ErrorMessage = ex.Message,
            };
        }
    }
}
