using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using WhithinMessenger.Domain.Models;

namespace WhithinMessenger.Infrastructure.Database.Configurations;

public class MemberConfiguration : IEntityTypeConfiguration<Member>
{
    public void Configure(EntityTypeBuilder<Member> builder)
    {
        builder.HasKey(e => e.Id);
        
        builder
            .Property(e => e.Id)
            .ValueGeneratedOnAdd();

        builder
            .HasIndex(e => new { e.UserId, e.ChatId }, "members_user_id_chat_id_key")
            .IsUnique();

        builder.Property(e => e.JoinedAt)
            .HasDefaultValueSql("CURRENT_TIMESTAMP");

        builder
            .HasOne(d => d.Chat)
            .WithMany(p => p.Members)
            .HasForeignKey(d => d.ChatId);

        builder
            .HasOne(d => d.User)
            .WithMany(p => p.Members)
            .HasForeignKey(d => d.UserId);
    }
}