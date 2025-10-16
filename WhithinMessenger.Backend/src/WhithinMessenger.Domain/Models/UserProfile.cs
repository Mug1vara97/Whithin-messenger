namespace WhithinMessenger.Domain.Models;

public class UserProfile
{
    public Guid Id { get; set; }

    public Guid UserId { get; set; }

    public string? Avatar { get; set; }

    public string? AvatarColor { get; set; }

    public string? Description { get; set; }

    public string? Banner { get; set; }

    public ApplicationUser User { get; set; } = null!;
}
