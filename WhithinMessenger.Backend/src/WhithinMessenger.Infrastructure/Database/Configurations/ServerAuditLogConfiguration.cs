using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using WhithinMessenger.Domain.Models;

namespace WhithinMessenger.Infrastructure.Database.Configurations;

public class ServerAuditLogConfiguration : IEntityTypeConfiguration<ServerAuditLog>
{
    public void Configure(EntityTypeBuilder<ServerAuditLog> builder)
    {
        builder.HasKey(e => e.Id);
        
        builder
            .Property(e => e.Id)
            .ValueGeneratedOnAdd();

        builder
            .Property(e => e.ActionType)
            .HasMaxLength(50);

        builder
            .Property(e => e.Details)
            .HasMaxLength(-1);
        
        builder
            .Property(e => e.Timestamp)
            .HasDefaultValueSql("CURRENT_TIMESTAMP");

        builder
            .HasOne(d => d.Server)
            .WithMany(p => p.ServerAuditLogs)
            .HasForeignKey(d => d.ServerId)
            .OnDelete(DeleteBehavior.Cascade);

        builder
            .HasOne(d => d.User)
            .WithMany(p => p.ServerAuditLogs)
            .HasForeignKey(d => d.UserId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}