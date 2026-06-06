namespace WhithinMessenger.Domain.Models;

public class StickerPack
{
    public Guid Id { get; set; }
    public string Title { get; set; } = null!;
    public string? CoverImagePath { get; set; }
    public Guid CreatedByUserId { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public ApplicationUser CreatedByUser { get; set; } = null!;
    public ICollection<Sticker> Stickers { get; set; } = new List<Sticker>();
}
