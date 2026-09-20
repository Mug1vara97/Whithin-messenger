using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using WhithinMessenger.Domain.Models;

namespace WhithinMessenger.Infrastructure.Database.Configurations;

public class FeedPostAttachmentConfiguration : IEntityTypeConfiguration<FeedPostAttachment>
{
    public void Configure(EntityTypeBuilder<FeedPostAttachment> builder)
    {
        builder.ToTable("FeedPostAttachments");

        builder.HasKey(e => e.Id);

        builder.Property(e => e.FileName)
            .HasMaxLength(255)
            .IsRequired();

        builder.Property(e => e.OriginalFileName)
            .HasMaxLength(255)
            .IsRequired();

        builder.Property(e => e.FilePath)
            .HasMaxLength(500)
            .IsRequired();

        builder.Property(e => e.ContentType)
            .HasMaxLength(150)
            .IsRequired();

        builder.Property(e => e.ThumbnailPath)
            .HasMaxLength(500);

        builder.HasIndex(e => e.FeedPostId);

        builder.HasOne(e => e.FeedPost)
            .WithMany(p => p.Attachments)
            .HasForeignKey(e => e.FeedPostId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
