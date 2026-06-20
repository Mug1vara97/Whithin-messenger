namespace WhithinMessenger.Domain.Models;

public class UserProfile
{
    public Guid Id { get; set; }

    public Guid UserId { get; set; }

    public string? Avatar { get; set; }

    public string? AvatarColor { get; set; }

    public string? Description { get; set; }

    /// <summary>Отображаемый ник. Логин — <see cref="ApplicationUser.UserName"/>.</summary>
    public string? DisplayName { get; set; }

    public string? Banner { get; set; }

    public string? Nameplate { get; set; }

    public string? AvatarDecoration { get; set; }

    public ApplicationUser User { get; set; } = null!;
}
