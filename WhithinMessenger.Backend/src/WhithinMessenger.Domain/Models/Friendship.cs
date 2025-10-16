namespace WhithinMessenger.Domain.Models;

public class Friendship
{
    public Guid Id { get; set; }
    
    public Guid RequesterId { get; set; }
    
    public Guid AddresseeId { get; set; }
    
    public FriendshipStatus Status { get; set; }
    
    public DateTimeOffset CreatedAt { get; set; }
    
    public DateTimeOffset? UpdatedAt { get; set; }
    
    public ApplicationUser Requester { get; set; } = null!;
    
    public ApplicationUser Addressee { get; set; } = null!;
}

public enum FriendshipStatus
{
    Pending,    // Ожидает подтверждения
    Accepted,   // Принята
    Declined,   // Отклонена
    Blocked     // Заблокирована
}








