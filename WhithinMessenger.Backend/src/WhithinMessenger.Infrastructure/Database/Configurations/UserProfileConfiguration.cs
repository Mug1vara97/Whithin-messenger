using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using WhithinMessenger.Domain.Models;

namespace WhithinMessenger.Infrastructure.Database.Configurations;

public class UserProfileConfiguration : IEntityTypeConfiguration<UserProfile>
{
    public void Configure(EntityTypeBuilder<UserProfile> builder)
    {
        builder.HasKey(e => e.Id);

        builder
            .HasIndex(e => e.UserId, "user_profiles_user_id_key")
            .IsUnique();

        builder
            .Property(e => e.Avatar)
            .HasMaxLength(255);

        builder
            .Property(e => e.AvatarColor)
            .HasMaxLength(7)
            .HasDefaultValue("#5865F2");

        builder
            .Property(e => e.Banner)
            .HasMaxLength(255);

        builder
            .Property(e => e.Description)
            .HasMaxLength(-1);

        builder
            .HasOne(d => d.User)
            .WithOne(p => p.UserProfile)
            .HasForeignKey<UserProfile>(d => d.UserId);
    }
}