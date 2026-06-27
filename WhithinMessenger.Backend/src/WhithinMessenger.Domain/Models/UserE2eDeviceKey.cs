namespace WhithinMessenger.Domain.Models;

public class UserE2eDeviceKey
{
    public Guid UserId { get; set; }

    /// <summary>Logical device id, e.g. "web-default".</summary>
    public string DeviceId { get; set; } = "default";

    /// <summary>Base64-encoded Curve25519 public key (32 bytes).</summary>
    public string PublicKeyBase64 { get; set; } = null!;

    public DateTimeOffset UpdatedAt { get; set; }

    public ApplicationUser User { get; set; } = null!;
}
