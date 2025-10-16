using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using WhithinMessenger.Domain.Models;

namespace WhithinMessenger.Infrastructure.Database.Configurations;

public class FriendshipConfiguration : IEntityTypeConfiguration<Friendship>
{
    public void Configure(EntityTypeBuilder<Friendship> builder)
    {
        builder.HasKey(f => f.Id);
        
        builder.Property(f => f.RequesterId)
            .IsRequired();
            
        builder.Property(f => f.AddresseeId)
            .IsRequired();
            
        builder.Property(f => f.Status)
            .IsRequired()
            .HasConversion<string>();
            
        builder.Property(f => f.CreatedAt)
            .IsRequired();
            
        builder.Property(f => f.UpdatedAt)
            .IsRequired(false);

        // Настройка связей
        builder.HasOne(f => f.Requester)
            .WithMany()
            .HasForeignKey(f => f.RequesterId)
            .OnDelete(DeleteBehavior.Cascade);
            
        builder.HasOne(f => f.Addressee)
            .WithMany()
            .HasForeignKey(f => f.AddresseeId)
            .OnDelete(DeleteBehavior.Cascade);

        // Индексы для оптимизации запросов
        builder.HasIndex(f => new { f.RequesterId, f.AddresseeId })
            .IsUnique();
            
        builder.HasIndex(f => f.RequesterId);
        builder.HasIndex(f => f.AddresseeId);
        builder.HasIndex(f => f.Status);
    }
}








