using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using WhithinMessenger.Domain.Models;

namespace WhithinMessenger.Infrastructure.Database.Configurations;

public class NotificationConfiguration : IEntityTypeConfiguration<Notification>
{
    public void Configure(EntityTypeBuilder<Notification> builder)
    {
        builder.HasKey(e => e.Id);

        builder.Property(e => e.Id).ValueGeneratedOnAdd();

        builder
            .Property(e => e.Type)
            .HasMaxLength(50);

        builder
            .Property(e => e.Content)
            .HasMaxLength(-1);

        builder
            .Property(e => e.CreatedAt)
            .HasDefaultValueSql("CURRENT_TIMESTAMP");

        builder
            .HasOne(d => d.User)
            .WithMany()
            .HasForeignKey(d => d.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        builder
            .HasOne(d => d.Chat)
            .WithMany()
            .HasForeignKey(d => d.ChatId)
            .OnDelete(DeleteBehavior.Cascade);

        builder
            .HasOne(d => d.Message)
            .WithMany()
            .HasForeignKey(d => d.MessageId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}