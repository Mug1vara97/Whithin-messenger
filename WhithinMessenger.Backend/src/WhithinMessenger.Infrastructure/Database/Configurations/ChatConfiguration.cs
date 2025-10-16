using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using WhithinMessenger.Domain.Models;

namespace WhithinMessenger.Infrastructure.Database.Configurations;

public class ChatConfiguration : IEntityTypeConfiguration<Chat>
{
    public void Configure(EntityTypeBuilder<Chat> builder)
    {
        builder.HasKey(e => e.Id);

        builder
            .Property(e => e.Id)
            .ValueGeneratedOnAdd();

        builder
            .Property(e => e.ChatOrder)
            .HasDefaultValue(0);

        builder
            .Property(e => e.CreatedAt)
            .HasDefaultValueSql("CURRENT_TIMESTAMP");

        builder
            .Property(e => e.Name)
            .HasMaxLength(100);

        builder
            .HasOne(d => d.Category)
            .WithMany(p => p.Chats)
            .HasForeignKey(d => d.CategoryId)
            .OnDelete(DeleteBehavior.SetNull);

        builder
            .HasOne(d => d.Server)
            .WithMany(p => p.Chats)
            .HasForeignKey(d => d.ServerId)
            .OnDelete(DeleteBehavior.SetNull);

        builder
            .HasOne(d => d.Type)
            .WithMany(p => p.Chats)
            .HasForeignKey(d => d.TypeId);
    }
}