namespace WhithinMessenger.Domain.Models;

public class ChatE2eWrappedKey
{
    public Guid ChatId { get; set; }

    public Guid UserId { get; set; }

    public string DeviceId { get; set; } = "default";

    /// <summary>Chat symmetric key sealed for UserId (libsodium crypto_box_seal).</summary>
    public string WrappedKeyBase64 { get; set; } = null!;

    /// <summary>Shared fingerprint (SHA-256 hex) of the underlying chat key for conflict detection.</summary>
    public string? ChatKeyFingerprint { get; set; }

    public DateTimeOffset UpdatedAt { get; set; }

    public Chat Chat { get; set; } = null!;

    public ApplicationUser User { get; set; } = null!;
}
