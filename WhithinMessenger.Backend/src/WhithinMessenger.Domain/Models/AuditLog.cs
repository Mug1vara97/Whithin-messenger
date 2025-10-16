namespace WhithinMessenger.Domain.Models;

public class AuditLog
{
    public Guid Id { get; set; }

    public Guid ServerId { get; set; }

    public Guid UserId { get; set; }

    public string ActionType { get; set; } = null!;

    public string TargetType { get; set; } = null!;

    public Guid? TargetId { get; set; }

    public string? Changes { get; set; }

    public DateTimeOffset CreatedAt { get; set; }

    public Server Server { get; set; } = null!;

    public ApplicationUser User { get; set; } = null!;
}
