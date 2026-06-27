using MediatR;
using WhithinMessenger.Application.CommandsAndQueries.Stickers;
using WhithinMessenger.Domain.Interfaces;
using WhithinMessenger.Domain.Models;

namespace WhithinMessenger.Application.CommandsAndQueries.Stickers.CreateStickerPack;

public class CreateStickerPackCommandHandler : IRequestHandler<CreateStickerPackCommand, CreateStickerPackResult>
{
    private readonly IStickerPackRepository _stickerPackRepository;

    public CreateStickerPackCommandHandler(IStickerPackRepository stickerPackRepository)
    {
        _stickerPackRepository = stickerPackRepository;
    }

    public async Task<CreateStickerPackResult> Handle(
        CreateStickerPackCommand request,
        CancellationToken cancellationToken)
    {
        try
        {
            var title = request.Title?.Trim();
            if (string.IsNullOrWhiteSpace(title))
            {
                return new CreateStickerPackResult
                {
                    Success = false,
                    ErrorMessage = "Укажите название стикерпака"
                };
            }

            if (title.Length > 100)
            {
                return new CreateStickerPackResult
                {
                    Success = false,
                    ErrorMessage = "Название не может быть длиннее 100 символов"
                };
            }

            var pack = new StickerPack
            {
                Id = Guid.NewGuid(),
                Title = title,
                CreatedByUserId = request.UserId,
                CreatedAt = DateTimeOffset.UtcNow
            };

            await _stickerPackRepository.CreatePackAsync(pack, cancellationToken);
            await _stickerPackRepository.InstallPackForUserAsync(request.UserId, pack.Id, cancellationToken);

            var created = await _stickerPackRepository.GetByIdWithStickersAsync(pack.Id, cancellationToken);
            if (created == null)
            {
                return new CreateStickerPackResult
                {
                    Success = false,
                    ErrorMessage = "Не удалось создать стикерпак"
                };
            }

            return new CreateStickerPackResult
            {
                Success = true,
                Pack = StickerPackMapper.ToDto(created)
            };
        }
        catch (Exception ex)
        {
            return new CreateStickerPackResult
            {
                Success = false,
                ErrorMessage = ex.Message
            };
        }
    }
}
