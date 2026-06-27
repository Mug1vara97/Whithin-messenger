namespace WhithinMessenger.Domain.Models;

public class ChatE2eWrappedKey
{
    public Guid ChatId { get; set; }

    public Guid UserId { get; set; }

    public string DeviceId { get; set; } = "default";

    /// <summary>Chat symmetric key sealed for UserId (libsodium crypto_box_seal).</summary>
    public string WrappedKeyBase64 { get; set; } = null!;

    public DateTimeOffset UpdatedAt { get; set; }

    public Chat Chat { get; set; } = null!;

    public ApplicationUser User { get; set; } = null!;
}
