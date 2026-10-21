using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using WhithinMessenger.Domain.Models;

namespace WhithinMessenger.Infrastructure.Database.Configurations;

public class ServerEventConfiguration : IEntityTypeConfiguration<ServerEvent>
{
    public void Configure(EntityTypeBuilder<ServerEvent> builder)
    {
        builder.ToTable("ServerEvents");
        builder.HasKey(e => e.Id);

        builder.Property(e => e.Title)
            .HasMaxLength(200)
            .IsRequired();

        builder.Property(e => e.Description)
            .HasMaxLength(4000);

        builder.Property(e => e.ExternalLocation)
            .HasMaxLength(500);

        builder.Property(e => e.LocationType)
            .HasConversion<int>();

        builder.Property(e => e.Status)
            .HasConversion<int>();

        builder.HasIndex(e => new { e.ServerId, e.StartsAt });
        builder.HasIndex(e => e.Status);

        builder.HasOne(e => e.Server)
            .WithMany()
            .HasForeignKey(e => e.ServerId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(e => e.CreatedBy)
            .WithMany()
            .HasForeignKey(e => e.CreatedByUserId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(e => e.Channel)
            .WithMany()
            .HasForeignKey(e => e.ChannelId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}

public class ServerEventRsvpConfiguration : IEntityTypeConfiguration<ServerEventRsvp>
{
    public void Configure(EntityTypeBuilder<ServerEventRsvp> builder)
    {
        builder.ToTable("ServerEventRsvps");
        builder.HasKey(e => new { e.EventId, e.UserId });

        builder.Property(e => e.Interest)
            .HasConversion<int>();

        builder.HasOne(e => e.Event)
            .WithMany(e => e.Rsvps)
            .HasForeignKey(e => e.EventId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(e => e.User)
            .WithMany()
            .HasForeignKey(e => e.UserId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
