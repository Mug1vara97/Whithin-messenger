using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using WhithinMessenger.Domain.Models;

namespace WhithinMessenger.Infrastructure.Database.Configurations;

public class ChatTypeConfiguration : IEntityTypeConfiguration<ChatType>
{
    public void Configure(EntityTypeBuilder<ChatType> builder)
    {
        builder.HasKey(e => e.Id);
        
        builder
            .Property(e => e.Id)
            .ValueGeneratedOnAdd();

        builder
            .HasIndex(e => e.TypeName, "chat_types_type_name_key")
            .IsUnique();

        builder.Property(e => e.TypeName)
            .HasMaxLength(20);

        builder.HasData(
            new ChatType
            {
                Id = Guid.Parse("11111111-1111-1111-1111-111111111111"),
                TypeName = "Private"
            },
            new ChatType
            {
                Id = Guid.Parse("22222222-2222-2222-2222-222222222222"),
                TypeName = "Group"
            },
            new ChatType
            {
                Id = Guid.Parse("33333333-3333-3333-3333-333333333333"),
                TypeName = "TextChannel"
            },
            new ChatType
            {
                Id = Guid.Parse("44444444-4444-4444-4444-444444444444"),
                TypeName = "VoiceChannel"
            }
        );
    }
}