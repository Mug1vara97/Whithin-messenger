using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using WhithinMessenger.Domain.Models;

namespace WhithinMessenger.Infrastructure.Database.Configurations;

public class ServerMemberConfiguration : IEntityTypeConfiguration<ServerMember>
{
    public void Configure(EntityTypeBuilder<ServerMember> builder)
    {
        builder.HasKey(e => e.Id);
        
        builder
            .Property(e => e.Id)
            .ValueGeneratedOnAdd();

        builder
            .HasIndex(e => new { e.ServerId, e.UserId }, "server_members_server_id_user_id_key")
            .IsUnique();

        builder.Property(e => e.JoinedAt)
            .HasDefaultValueSql("CURRENT_TIMESTAMP");

        builder
            .HasOne(d => d.Server)
            .WithMany(p => p.ServerMembers)
            .HasForeignKey(d => d.ServerId);

        builder
            .HasOne(d => d.User)
            .WithMany(p => p.ServerMembers)
            .HasForeignKey(d => d.UserId);
    }
}