using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using WhithinMessenger.Domain.Models;

namespace WhithinMessenger.Infrastructure.Database.Configurations;

public class UserMusicTrackConfiguration : IEntityTypeConfiguration<UserMusicTrack>
{
    public void Configure(EntityTypeBuilder<UserMusicTrack> builder)
    {
        builder.HasKey(x => x.Id);

        builder.Property(x => x.VideoId).IsRequired().HasMaxLength(32);
        builder.Property(x => x.Title).IsRequired().HasMaxLength(500);
        builder.Property(x => x.Artist).IsRequired().HasMaxLength(300);
        builder.Property(x => x.ThumbnailUrl).HasMaxLength(1000);
        builder.Property(x => x.AddedAt).IsRequired();

        builder.HasOne(x => x.User)
            .WithMany()
            .HasForeignKey(x => x.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(x => new { x.UserId, x.VideoId }).IsUnique();
        builder.HasIndex(x => new { x.UserId, x.AddedAt });
    }
}
