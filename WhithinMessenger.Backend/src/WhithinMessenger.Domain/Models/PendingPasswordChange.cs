namespace WhithinMessenger.Domain.Models;

public class PendingPasswordChange
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public required string PasswordHash { get; set; }
    public required string Token { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset ExpiresAt { get; set; }
}
