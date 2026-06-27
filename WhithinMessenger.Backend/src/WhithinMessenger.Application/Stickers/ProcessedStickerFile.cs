namespace WhithinMessenger.Application.Stickers;

public sealed record ProcessedStickerFile(
    string SourceName,
    byte[] Bytes,
    string Extension,
    string ContentType);
