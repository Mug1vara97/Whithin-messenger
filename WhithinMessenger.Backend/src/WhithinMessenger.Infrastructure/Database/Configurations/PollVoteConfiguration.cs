using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using WhithinMessenger.Domain.Models;

namespace WhithinMessenger.Infrastructure.Database.Configurations;

public class PollVoteConfiguration : IEntityTypeConfiguration<PollVote>
{
    public void Configure(EntityTypeBuilder<PollVote> builder)
    {
        builder.HasKey(e => e.Id);

        builder.Property(e => e.CreatedAt)
            .HasDefaultValueSql("CURRENT_TIMESTAMP");

        builder.HasOne(e => e.PollOption)
            .WithMany(o => o.Votes)
            .HasForeignKey(e => e.PollOptionId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(e => e.User)
            .WithMany()
            .HasForeignKey(e => e.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(e => new { e.PollOptionId, e.UserId })
            .IsUnique();
    }
}
