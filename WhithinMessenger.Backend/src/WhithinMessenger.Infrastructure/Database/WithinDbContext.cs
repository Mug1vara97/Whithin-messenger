using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using WhithinMessenger.Domain.Models;

namespace WhithinMessenger.Infrastructure.Database;

public class WithinDbContext : IdentityDbContext<ApplicationUser, IdentityRole<Guid>, Guid>
{
    public WithinDbContext(DbContextOptions<WithinDbContext> options) : base(options)
    {
    }

    public DbSet<Chat> Chats { get; set; }
    public DbSet<Member> Members { get; set; }
    public DbSet<Message> Messages { get; set; }
    public DbSet<MessageRead> MessageReads { get; set; }
    public DbSet<MessageDelivery> MessageDeliveries { get; set; }
    public DbSet<Server> Servers { get; set; }
    public DbSet<ServerMember> ServerMembers { get; set; }
    public DbSet<ServerRole> ServerRoles { get; set; }
    public DbSet<UserServerRole> UserServerRoles { get; set; }
    public DbSet<UserServerOrder> UserServerOrders { get; set; }
    public DbSet<ServerAuditLog> ServerAuditLogs { get; set; }
    public DbSet<AuditLog> AuditLogs { get; set; }
    public DbSet<Notification> Notifications { get; set; }
    public DbSet<RefreshToken> RefreshTokens { get; set; }
    public DbSet<UserProfile> UserProfiles { get; set; }
    public DbSet<ChatCategory> ChatCategories { get; set; }
    public DbSet<ChatType> ChatTypes { get; set; }
    public DbSet<MediaFile> MediaFiles { get; set; }
    public DbSet<Friendship> Friendships { get; set; }
    public DbSet<StickerPack> StickerPacks { get; set; }
    public DbSet<Sticker> Stickers { get; set; }
    public DbSet<UserStickerPack> UserStickerPacks { get; set; }
    public DbSet<PendingPasswordChange> PendingPasswordChanges { get; set; }
    public DbSet<PendingPasswordReset> PendingPasswordResets { get; set; }
    public DbSet<IdeaBoardCard> IdeaBoardCards { get; set; }
    public DbSet<MessagePoll> MessagePolls { get; set; }
    public DbSet<PollOption> PollOptions { get; set; }
    public DbSet<PollVote> PollVotes { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(WithinDbContext).Assembly);
    }
}