namespace WhithinMessenger.Domain.Models;

public class RefreshToken
{
    public Guid Id { get; set; }
    public required string Token { get; set; }
    public DateTimeOffset ExpirationDate { get; set; }
    public bool Expired => DateTimeOffset.UtcNow > ExpirationDate;
    public DateTimeOffset CreatedDate { get; set; }
    public Guid UserId { get; set; }
    public  required ApplicationUser User { get; set; }
}