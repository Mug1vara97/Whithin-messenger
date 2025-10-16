namespace WhithinMessenger.Domain.Models;

public class ServerRole
{
    public Guid Id { get; set; }

    public Guid ServerId { get; set; }

    public string RoleName { get; set; } = null!;

    public string Permissions { get; set; } = null!;

    public string? Color { get; set; }

    public DateTimeOffset CreatedAt { get; set; }

    public Server Server { get; set; } = null!;

    public ICollection<UserServerRole> UserServerRoles { get; set; } = new List<UserServerRole>();
}
