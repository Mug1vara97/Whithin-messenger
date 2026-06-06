using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using WhithinMessenger.Domain.Models;

namespace WhithinMessenger.Infrastructure.Database.Configurations;

public class UserStickerPackConfiguration : IEntityTypeConfiguration<UserStickerPack>
{
    public void Configure(EntityTypeBuilder<UserStickerPack> builder)
    {
        builder.HasKey(x => x.Id);

        builder.Property(x => x.InstalledAt).IsRequired();

        builder.HasOne(x => x.User)
            .WithMany()
            .HasForeignKey(x => x.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(x => x.StickerPack)
            .WithMany()
            .HasForeignKey(x => x.StickerPackId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(x => new { x.UserId, x.StickerPackId }).IsUnique();
        builder.HasIndex(x => x.UserId);
    }
}
