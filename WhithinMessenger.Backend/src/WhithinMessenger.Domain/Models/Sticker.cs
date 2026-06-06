namespace WhithinMessenger.Domain.Models;

public class Sticker
{
    public Guid Id { get; set; }
    public Guid StickerPackId { get; set; }
    public string FilePath { get; set; } = string.Empty;
    public string ContentType { get; set; } = "image/webp";
    public int SortOrder { get; set; }
    public StickerPack StickerPack { get; set; } = null!;
}
