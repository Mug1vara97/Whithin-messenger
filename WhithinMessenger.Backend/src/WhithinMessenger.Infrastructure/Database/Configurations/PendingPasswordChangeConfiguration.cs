using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using WhithinMessenger.Domain.Models;

namespace WhithinMessenger.Infrastructure.Database.Configurations;

public class PendingPasswordChangeConfiguration : IEntityTypeConfiguration<PendingPasswordChange>
{
    public void Configure(EntityTypeBuilder<PendingPasswordChange> builder)
    {
        builder.HasKey(x => x.Id);

        builder.Property(x => x.Id).ValueGeneratedOnAdd();
        builder.Property(x => x.PasswordHash).IsRequired();
        builder.Property(x => x.Token).IsRequired();
        builder.HasIndex(x => x.Token).IsUnique();
        builder.HasIndex(x => x.UserId);
    }
}
