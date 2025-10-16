using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using WhithinMessenger.Domain.Models;

namespace WhithinMessenger.Infrastructure.Database.Configurations;

public class ServerRoleConfiguration : IEntityTypeConfiguration<ServerRole>
{
    public void Configure(EntityTypeBuilder<ServerRole> builder)
    {
        builder.HasKey(e => e.Id);
        
        builder
            .Property(e => e.Id)
            .ValueGeneratedOnAdd();

        builder
            .HasIndex(e => new { e.ServerId, e.RoleName }, "server_roles_server_id_role_name_key")
            .IsUnique();

        builder.Property(e => e.Color)
            .HasMaxLength(7)
            .HasDefaultValue("#99AAB5");
        
        builder.Property(e => e.CreatedAt)
            .HasDefaultValueSql("CURRENT_TIMESTAMP");

        builder
            .Property(e => e.Permissions)
            .HasColumnType("jsonb");

        builder
            .Property(e => e.RoleName)
            .HasMaxLength(50);

        builder
            .HasOne(d => d.Server)
            .WithMany(p => p.ServerRoles)
            .HasForeignKey(d => d.ServerId);
    }
}