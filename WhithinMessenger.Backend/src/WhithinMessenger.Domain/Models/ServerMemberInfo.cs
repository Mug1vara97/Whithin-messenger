namespace WhithinMessenger.Domain.Models;

public class ServerMemberInfo
{
    public Guid UserId { get; set; }
    public string Username { get; set; } = string.Empty;
    public string? Avatar { get; set; }
    public string? AvatarColor { get; set; }
    public string UserStatus { get; set; } = string.Empty;
    public DateTime? LastSeen { get; set; }
    public DateTime JoinedAt { get; set; }
    public List<ServerMemberRole> Roles { get; set; } = new();
}

public class ServerMemberRole
{
    public Guid RoleId { get; set; }
    public string RoleName { get; set; } = string.Empty;
    public string Color { get; set; } = string.Empty;
}



