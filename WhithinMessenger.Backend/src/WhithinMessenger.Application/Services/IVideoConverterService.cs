namespace WhithinMessenger.Application.Services;

public interface IVideoConverterService
{
    Task<string?> ConvertVideoToH264Async(string inputFilePath, string outputFolderPath, CancellationToken cancellationToken = default);
    bool IsVideoFile(string contentType);
    bool NeedsConversion(string filePath);
}
