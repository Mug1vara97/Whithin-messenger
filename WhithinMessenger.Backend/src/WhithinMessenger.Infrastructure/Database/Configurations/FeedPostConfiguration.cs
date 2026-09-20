using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using WhithinMessenger.Domain.Models;

namespace WhithinMessenger.Infrastructure.Database.Configurations;

public class FeedPostConfiguration : IEntityTypeConfiguration<FeedPost>
{
    public void Configure(EntityTypeBuilder<FeedPost> builder)
    {
        builder.ToTable("FeedPosts");

        builder.HasKey(e => e.Id);

        builder.Property(e => e.Text)
            .HasMaxLength(2000)
            .IsRequired();

        builder.Property(e => e.Scope)
            .HasConversion<int>()
            .IsRequired();

        builder.HasIndex(e => new { e.Scope, e.CreatedAt });
        builder.HasIndex(e => new { e.AuthorUserId, e.Scope, e.CreatedAt });
        builder.HasIndex(e => new { e.ServerId, e.CreatedAt });

        builder.HasOne(e => e.Author)
            .WithMany()
            .HasForeignKey(e => e.AuthorUserId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(e => e.Server)
            .WithMany()
            .HasForeignKey(e => e.ServerId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
