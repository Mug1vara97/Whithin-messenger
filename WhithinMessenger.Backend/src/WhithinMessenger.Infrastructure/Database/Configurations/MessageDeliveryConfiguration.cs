using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using WhithinMessenger.Domain.Models;

namespace WhithinMessenger.Infrastructure.Database.Configurations;

public class MessageDeliveryConfiguration : IEntityTypeConfiguration<MessageDelivery>
{
    public void Configure(EntityTypeBuilder<MessageDelivery> builder)
    {
        builder.HasKey(e => e.Id);

        builder
            .HasIndex(e => new { e.MessageId, e.UserId }, "message_deliveries_message_id_user_id_key")
            .IsUnique();

        builder
            .Property(e => e.DeliveredAt)
            .HasDefaultValueSql("CURRENT_TIMESTAMP");

        builder
            .HasOne(d => d.Message)
            .WithMany(p => p.MessageDeliveries)
            .HasForeignKey(d => d.MessageId)
            .OnDelete(DeleteBehavior.Cascade);

        builder
            .HasOne(d => d.User)
            .WithMany(p => p.MessageDeliveries)
            .HasForeignKey(d => d.UserId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
