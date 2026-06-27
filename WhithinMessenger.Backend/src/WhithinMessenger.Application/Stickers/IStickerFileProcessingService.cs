namespace WhithinMessenger.Application.Stickers;

public interface IStickerFileProcessingService
{
    Task<ProcessedStickerFile?> ProcessAsync(
        string fileName,
        byte[] bytes,
        CancellationToken cancellationToken = default);
}
