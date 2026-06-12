using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using WhithinMessenger.Domain.Models;

namespace WhithinMessenger.Infrastructure.Database.Configurations;

public class IdeaBoardCardConfiguration : IEntityTypeConfiguration<IdeaBoardCard>
{
    public void Configure(EntityTypeBuilder<IdeaBoardCard> builder)
    {
        builder.HasKey(e => e.Id);

        builder.Property(e => e.Title)
            .HasMaxLength(200)
            .IsRequired();

        builder.Property(e => e.Body)
            .HasMaxLength(4000)
            .IsRequired();

        builder.Property(e => e.Tag)
            .HasMaxLength(50);

        builder.Property(e => e.SourceUrl)
            .HasMaxLength(500);

        builder.HasIndex(e => e.ChatId);

        builder.HasOne(e => e.Chat)
            .WithMany()
            .HasForeignKey(e => e.ChatId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(e => e.Author)
            .WithMany()
            .HasForeignKey(e => e.AuthorUserId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
