using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using WhithinMessenger.Domain.Models;

namespace WhithinMessenger.Infrastructure.Database.Configurations;

public class AuditLogConfiguration : IEntityTypeConfiguration<AuditLog>
{
    public void Configure(EntityTypeBuilder<AuditLog> builder)
    {
        builder.HasKey(e => e.Id);

        builder
            .Property(e => e.Id)
            .ValueGeneratedOnAdd();

        builder
            .Property(e => e.ActionType)
            .HasMaxLength(50);

        builder
            .Property(e => e.Changes)
            .HasColumnType("jsonb");

        builder
            .Property(e => e.CreatedAt)
            .HasDefaultValueSql("CURRENT_TIMESTAMP");

        builder
            .Property(e => e.TargetType)
            .HasMaxLength(50);

        builder
            .HasOne(d => d.Server)
            .WithMany(p => p.AuditLogs)
            .HasForeignKey(d => d.ServerId);

        builder
            .HasOne(d => d.User)
            .WithMany(p => p.AuditLogs)
            .HasForeignKey(d => d.UserId);
    }
}