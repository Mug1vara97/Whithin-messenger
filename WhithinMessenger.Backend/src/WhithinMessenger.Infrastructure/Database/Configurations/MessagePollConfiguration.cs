using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using WhithinMessenger.Domain.Models;

namespace WhithinMessenger.Infrastructure.Database.Configurations;

public class MessagePollConfiguration : IEntityTypeConfiguration<MessagePoll>
{
    public void Configure(EntityTypeBuilder<MessagePoll> builder)
    {
        builder.HasKey(e => e.Id);

        builder.Property(e => e.Question)
            .HasMaxLength(500)
            .IsRequired();

        builder.HasOne(e => e.Message)
            .WithOne(m => m.Poll)
            .HasForeignKey<MessagePoll>(e => e.MessageId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasMany(e => e.Options)
            .WithOne(o => o.Poll)
            .HasForeignKey(o => o.PollId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
