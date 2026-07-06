using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using WhithinMessenger.Domain.Models;

namespace WhithinMessenger.Infrastructure.Database.Configurations;

public class UserE2eKeyBackupConfiguration : IEntityTypeConfiguration<UserE2eKeyBackup>
{
    public void Configure(EntityTypeBuilder<UserE2eKeyBackup> builder)
    {
        builder.ToTable("UserE2eKeyBackups");

        builder.HasKey(e => e.UserId);

        builder.Property(e => e.PayloadJson)
            .IsRequired();

        builder.Property(e => e.UpdatedAt)
            .IsRequired();

        builder.HasOne(e => e.User)
            .WithMany()
            .HasForeignKey(e => e.UserId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
