using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using WhithinMessenger.Domain.Models;

namespace WhithinMessenger.Infrastructure.Database.Configurations;

public class FeedPostReactionConfiguration : IEntityTypeConfiguration<FeedPostReaction>
{
    public void Configure(EntityTypeBuilder<FeedPostReaction> builder)
    {
        builder.ToTable("FeedPostReactions");
        builder.HasKey(e => e.Id);

        builder.Property(e => e.Value)
            .HasConversion<int>()
            .IsRequired();

        builder.HasIndex(e => new { e.FeedPostId, e.UserId }).IsUnique();
        builder.HasIndex(e => e.FeedPostId);

        builder.HasOne(e => e.FeedPost)
            .WithMany(p => p.Reactions)
            .HasForeignKey(e => e.FeedPostId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(e => e.User)
            .WithMany()
            .HasForeignKey(e => e.UserId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

public class FeedPostCommentConfiguration : IEntityTypeConfiguration<FeedPostComment>
{
    public void Configure(EntityTypeBuilder<FeedPostComment> builder)
    {
        builder.ToTable("FeedPostComments");
        builder.HasKey(e => e.Id);

        builder.Property(e => e.Text)
            .HasMaxLength(2000)
            .IsRequired();

        builder.HasIndex(e => new { e.FeedPostId, e.CreatedAt });

        builder.HasOne(e => e.FeedPost)
            .WithMany(p => p.Comments)
            .HasForeignKey(e => e.FeedPostId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(e => e.Author)
            .WithMany()
            .HasForeignKey(e => e.AuthorUserId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
