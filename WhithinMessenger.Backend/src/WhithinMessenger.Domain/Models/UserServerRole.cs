namespace WhithinMessenger.Domain.Models;

public class UserServerRole
{
    public Guid Id { get; set; }

    public Guid ServerId { get; set; }

    public Guid RoleId { get; set; }

    public DateTimeOffset AssignedAt { get; set; }

    public required ServerRole Role { get; set; }

    public required Server Server { get; set; }

    public required ApplicationUser User { get; set; }
}