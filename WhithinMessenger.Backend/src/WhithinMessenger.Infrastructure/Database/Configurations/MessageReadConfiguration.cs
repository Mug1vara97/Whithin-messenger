using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using WhithinMessenger.Domain.Models;

namespace WhithinMessenger.Infrastructure.Database.Configurations;

public class MessageReadConfiguration : IEntityTypeConfiguration<MessageRead>
{
    public void Configure(EntityTypeBuilder<MessageRead> builder)
    {
        builder.HasKey(e => e.Id);

        builder
            .HasIndex(e => new { e.MessageId, e.UserId }, "message_reads_message_id_user_id_key")
            .IsUnique();

        builder
            .Property(e => e.ReadAt)
            .HasDefaultValueSql("CURRENT_TIMESTAMP");

        builder
            .HasOne(d => d.Message)
            .WithMany(p => p.MessageReads)
            .HasForeignKey(d => d.MessageId)
            .OnDelete(DeleteBehavior.Cascade);

        builder
            .HasOne(d => d.User)
            .WithMany(p => p.MessageReads)
            .HasForeignKey(d => d.UserId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}