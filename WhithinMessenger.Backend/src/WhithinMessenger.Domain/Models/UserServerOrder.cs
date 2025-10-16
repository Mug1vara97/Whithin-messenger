namespace WhithinMessenger.Domain.Models;

public class UserServerOrder
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public Guid ServerId { get; set; }
    public int Position { get; set; }

    public ApplicationUser User { get; set; }
    public Server Server { get; set; }
} 