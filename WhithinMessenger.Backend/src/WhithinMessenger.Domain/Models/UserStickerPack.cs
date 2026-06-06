namespace WhithinMessenger.Domain.Models;

public class UserStickerPack
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public Guid StickerPackId { get; set; }
    public DateTimeOffset InstalledAt { get; set; }
    public ApplicationUser User { get; set; } = null!;
    public StickerPack StickerPack { get; set; } = null!;
}
