using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using WhithinMessenger.Domain.Models;

namespace WhithinMessenger.Infrastructure.Database.Configurations;

public class ChatCategoryConfiguration : IEntityTypeConfiguration<ChatCategory>
{
    public void Configure(EntityTypeBuilder<ChatCategory> builder)
    {
        builder.HasKey(e => e.Id);

        builder
            .Property(e => e.Id)
            .ValueGeneratedOnAdd();

        builder
            .Property(e => e.CategoryName)
            .HasMaxLength(100);

        builder
            .Property(e => e.CategoryOrder)
            .HasDefaultValue(0);

        builder
            .HasOne(d => d.Server)
            .WithMany(p => p.ChatCategories)
            .HasForeignKey(d => d.ServerId);
    }
}