using System.ComponentModel.DataAnnotations;

namespace WhithinMessenger.Domain.Models
{
    public class Notification
    {
        public Guid Id { get; set; }

        public Guid UserId { get; set; }
        public ApplicationUser User { get; set; }

        public Guid ChatId { get; set; }
        public Chat Chat { get; set; }

        public Guid? MessageId { get; set; }
        public Message? Message { get; set; }

        public string Type { get; set; } = string.Empty;

        public string Content { get; set; } = string.Empty;

        public bool IsRead { get; set; } = false;

        public DateTimeOffset CreatedAt { get; set; }

        public DateTimeOffset ReadAt { get; set; }
    }

    public enum NotificationType
    {
        DirectMessage,
        GroupMessage,
        Mention,
        Reaction,
        Invitation
    }
}