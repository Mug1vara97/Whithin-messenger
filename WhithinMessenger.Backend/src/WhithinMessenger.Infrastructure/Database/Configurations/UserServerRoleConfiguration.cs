using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using WhithinMessenger.Domain.Models;

namespace WhithinMessenger.Infrastructure.Database.Configurations;

public class UserServerRoleConfiguration : IEntityTypeConfiguration<UserServerRole>
{
    public void Configure(EntityTypeBuilder<UserServerRole> builder)
    {
        builder.HasKey(e => new { UserId = e.Id, e.ServerId, e.RoleId });

        builder
            .Property(e => e.AssignedAt)
            .HasDefaultValueSql("CURRENT_TIMESTAMP");

        builder
            .HasOne(d => d.Role)
            .WithMany(p => p.UserServerRoles)
            .HasForeignKey(d => d.RoleId);

        builder
            .HasOne(d => d.Server)
            .WithMany(p => p.UserServerRoles)
            .HasForeignKey(d => d.ServerId);

        builder
            .HasOne(d => d.User)
            .WithMany(p => p.UserServerRoles)
            .HasForeignKey(d => d.Id);
    }
}