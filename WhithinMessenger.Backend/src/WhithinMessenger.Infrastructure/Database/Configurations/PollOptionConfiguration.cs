using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using WhithinMessenger.Domain.Models;

namespace WhithinMessenger.Infrastructure.Database.Configurations;

public class PollOptionConfiguration : IEntityTypeConfiguration<PollOption>
{
    public void Configure(EntityTypeBuilder<PollOption> builder)
    {
        builder.HasKey(e => e.Id);

        builder.Property(e => e.Text)
            .HasMaxLength(200)
            .IsRequired();
    }
}
