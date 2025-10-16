using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using WhithinMessenger.Domain.Models;

namespace WhithinMessenger.Infrastructure.Database.Configurations;

public class MessageConfiguration : IEntityTypeConfiguration<Message>
{
    public void Configure(EntityTypeBuilder<Message> builder)
    {
        builder.HasKey(e => e.Id);
        
        builder
            .Property(e => e.Id)
            .ValueGeneratedOnAdd();

        builder.Property(e => e.ContentType)
            .HasMaxLength(50);
        
        builder.Property(e => e.CreatedAt)
            .HasDefaultValueSql("CURRENT_TIMESTAMP");

        builder
            .HasOne(d => d.Chat)
            .WithMany(p => p.Messages)
            .HasForeignKey(d => d.ChatId);

        builder
            .HasOne(d => d.User)
            .WithMany(p => p.Messages)
            .HasForeignKey(d => d.UserId);

        builder
            .HasOne(d => d.RepliedToMessage)
            .WithMany(p => p.Replies)
            .HasForeignKey(d => d.RepliedToMessageId)
            .OnDelete(DeleteBehavior.SetNull);

        builder
            .HasOne(d => d.ForwardedFromMessage)
            .WithMany()
            .HasForeignKey(d => d.ForwardedFromMessageId)
            .OnDelete(DeleteBehavior.SetNull);

        builder
            .HasOne(d => d.ForwardedFromChat)
            .WithMany()
            .HasForeignKey(d => d.ForwardedFromChatId)
            .OnDelete(DeleteBehavior.SetNull);

        builder
            .HasOne(d => d.ForwardedByUser)
            .WithMany()
            .HasForeignKey(d => d.ForwardedByUserId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}