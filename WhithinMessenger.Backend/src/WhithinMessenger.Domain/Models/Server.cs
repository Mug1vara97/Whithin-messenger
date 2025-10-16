namespace WhithinMessenger.Domain.Models;

public class Server
{
    public Guid Id { get; set; }

    public string Name { get; set; } = null!;

    public Guid OwnerId { get; set; }

    public DateTimeOffset CreatedAt { get; set; }

    public string? Banner { get; set; }

    public string? BannerColor { get; set; }

    public string? Avatar { get; set; }

    public bool IsPublic { get; set; } = false;

    public string? Description { get; set; }

    public ICollection<AuditLog> AuditLogs { get; set; } = new List<AuditLog>();

    public ICollection<ChatCategory> ChatCategories { get; set; } = new List<ChatCategory>();

    public ICollection<Chat> Chats { get; set; } = new List<Chat>();

    public ApplicationUser Owner { get; set; } = null!;

    public ICollection<ServerMember> ServerMembers { get; set; } = new List<ServerMember>();

    public ICollection<ServerRole> ServerRoles { get; set; } = new List<ServerRole>();

    public ICollection<UserServerRole> UserServerRoles { get; set; } = new List<UserServerRole>();

    public ICollection<UserServerOrder> UserServerOrders { get; set; } = new List<UserServerOrder>();

    public ICollection<ServerAuditLog> ServerAuditLogs { get; set; } = new List<ServerAuditLog>();
}
