using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using WhithinMessenger.Domain.Models;

namespace WhithinMessenger.Infrastructure.Database.Configurations;

public class ServerConfiguration : IEntityTypeConfiguration<Server>
{
    public void Configure(EntityTypeBuilder<Server> builder)
    {
        builder.HasKey(e => e.Id);
        
        builder
            .Property(e => e.Id)
            .ValueGeneratedOnAdd();

        builder
            .Property(e => e.CreatedAt)
            .HasDefaultValueSql("CURRENT_TIMESTAMP");

        builder
            .Property(e => e.Name)
            .HasMaxLength(100);

        builder
            .HasOne(d => d.Owner)
            .WithMany(p => p.Servers)
            .HasForeignKey(d => d.OwnerId);
    }
}