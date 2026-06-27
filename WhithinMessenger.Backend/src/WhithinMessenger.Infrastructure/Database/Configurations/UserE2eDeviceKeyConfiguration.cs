using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using WhithinMessenger.Domain.Models;

namespace WhithinMessenger.Infrastructure.Database.Configurations;

public class UserE2eDeviceKeyConfiguration : IEntityTypeConfiguration<UserE2eDeviceKey>
{
    public void Configure(EntityTypeBuilder<UserE2eDeviceKey> builder)
    {
        builder.HasKey(e => new { e.UserId, e.DeviceId });

        builder.Property(e => e.DeviceId)
            .HasMaxLength(64);

        builder.Property(e => e.PublicKeyBase64)
            .HasMaxLength(128)
            .IsRequired();

        builder.Property(e => e.UpdatedAt)
            .HasDefaultValueSql("CURRENT_TIMESTAMP");

        builder
            .HasOne(e => e.User)
            .WithMany()
            .HasForeignKey(e => e.UserId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
