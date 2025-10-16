using Microsoft.AspNetCore.Identity;

namespace WhithinMessenger.Domain.Models;

public class ApplicationUser : IdentityUser<Guid>
{
    public DateTimeOffset CreatedAt { get; set; }

    public Status Status { get; set; } = Status.Online; 

    public DateTimeOffset LastSeen { get; set; }

    public ICollection<AuditLog> AuditLogs { get; set; } = [];

    public ICollection<Member> Members { get; set; } = [];

    public ICollection<Message> Messages { get; set; } = [];

    public ICollection<ServerMember> ServerMembers { get; set; } = [];

    public ICollection<Server> Servers { get; set; } = [];

    public UserProfile? UserProfile { get; set; }

    public ICollection<UserServerRole> UserServerRoles { get; set; } = [];

    public ICollection<UserServerOrder> UserServerOrders { get; set; } = [];

    public ICollection<ServerAuditLog> ServerAuditLogs { get; set; } = [];

    public ICollection<MessageRead> MessageReads { get; set; } = [];
    public ICollection<RefreshToken> RefreshTokens { get; set; } = [];
}

public enum Status
{
    Online,
    Inactive,
    DoNotDisturb,
    Offline
}