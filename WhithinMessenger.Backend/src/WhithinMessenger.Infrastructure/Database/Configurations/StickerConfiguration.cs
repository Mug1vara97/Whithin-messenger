using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using WhithinMessenger.Domain.Models;

namespace WhithinMessenger.Infrastructure.Database.Configurations;

public class StickerConfiguration : IEntityTypeConfiguration<Sticker>
{
    public void Configure(EntityTypeBuilder<Sticker> builder)
    {
        builder.HasKey(s => s.Id);

        builder.Property(s => s.FilePath)
            .IsRequired()
            .HasMaxLength(512);

        builder.Property(s => s.ContentType)
            .IsRequired()
            .HasMaxLength(64);

        builder.HasOne(s => s.StickerPack)
            .WithMany(p => p.Stickers)
            .HasForeignKey(s => s.StickerPackId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(s => s.StickerPackId);
        builder.HasIndex(s => new { s.StickerPackId, s.SortOrder });
    }
}
