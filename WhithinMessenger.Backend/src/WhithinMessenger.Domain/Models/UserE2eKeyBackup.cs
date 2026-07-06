namespace WhithinMessenger.Domain.Models;

public class UserE2eKeyBackup
{
    public Guid UserId { get; set; }
    public string PayloadJson { get; set; } = string.Empty;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

    public ApplicationUser User { get; set; } = null!;
}
