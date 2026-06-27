using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using WhithinMessenger.Domain.Models;

namespace WhithinMessenger.Infrastructure.Database.Configurations;

public class ChatE2eWrappedKeyConfiguration : IEntityTypeConfiguration<ChatE2eWrappedKey>
{
    public void Configure(EntityTypeBuilder<ChatE2eWrappedKey> builder)
    {
        builder.HasKey(e => new { e.ChatId, e.UserId, e.DeviceId });

        builder.Property(e => e.DeviceId)
            .HasMaxLength(64);

        builder.Property(e => e.WrappedKeyBase64)
            .HasMaxLength(256)
            .IsRequired();

        builder.Property(e => e.UpdatedAt)
            .HasDefaultValueSql("CURRENT_TIMESTAMP");

        builder
            .HasOne(e => e.Chat)
            .WithMany()
            .HasForeignKey(e => e.ChatId)
            .OnDelete(DeleteBehavior.Cascade);

        builder
            .HasOne(e => e.User)
            .WithMany()
            .HasForeignKey(e => e.UserId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
