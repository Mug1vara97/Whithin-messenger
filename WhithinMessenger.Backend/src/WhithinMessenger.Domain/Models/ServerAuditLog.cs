namespace WhithinMessenger.Domain.Models;

public class ServerAuditLog
{
    public Guid Id { get; set; }
    public Guid ServerId { get; set; }
    public Guid UserId { get; set; }
    public string ActionType { get; set; }
    public string Details { get; set; }
    public DateTimeOffset Timestamp { get; set; }

    public Server Server { get; set; }
    public ApplicationUser User { get; set; }
} 