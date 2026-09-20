using Microsoft.EntityFrameworkCore;
using WhithinMessenger.Domain.Models;

namespace WhithinMessenger.Infrastructure.Database;

/// <summary>
/// Ensures News chat type exists and every server has a public «Новости» channel.
/// </summary>
public static class NewsChannelDataFix
{
    public static async Task ApplyAsync(WithinDbContext context, CancellationToken cancellationToken = default)
    {
        var newsType = await context.ChatTypes
            .FirstOrDefaultAsync(t => t.Id == ChatTypeIds.News, cancellationToken);

        if (newsType == null)
        {
            context.ChatTypes.Add(new ChatType
            {
                Id = ChatTypeIds.News,
                TypeName = ChatTypeNames.News,
            });
            await context.SaveChangesAsync(cancellationToken);
        }
        else if (!string.Equals(newsType.TypeName, ChatTypeNames.News, StringComparison.Ordinal))
        {
            newsType.TypeName = ChatTypeNames.News;
            await context.SaveChangesAsync(cancellationToken);
        }

        var serverIds = await context.Servers
            .AsNoTracking()
            .Select(s => s.Id)
            .ToListAsync(cancellationToken);

        if (serverIds.Count == 0)
        {
            return;
        }

        var serversWithNews = await context.Chats
            .AsNoTracking()
            .Where(c => c.ServerId != null && c.TypeId == ChatTypeIds.News)
            .Select(c => c.ServerId!.Value)
            .Distinct()
            .ToListAsync(cancellationToken);

        var missingServerIds = serverIds.Except(serversWithNews).ToList();
        if (missingServerIds.Count == 0)
        {
            return;
        }

        foreach (var serverId in missingServerIds)
        {
            var textCategoryId = await context.ChatCategories
                .AsNoTracking()
                .Where(c => c.ServerId == serverId)
                .OrderBy(c => c.CategoryOrder)
                .Select(c => (Guid?)c.Id)
                .FirstOrDefaultAsync(cancellationToken);

            var orders = await context.Chats
                .AsNoTracking()
                .Where(c => c.ServerId == serverId && c.CategoryId == textCategoryId)
                .Select(c => c.ChatOrder)
                .ToListAsync(cancellationToken);
            var maxOrder = orders.Where(o => o.HasValue).Select(o => o!.Value).DefaultIfEmpty(0).Max();

            var newsChat = new Chat
            {
                Id = Guid.NewGuid(),
                Name = "Новости",
                TypeId = ChatTypeIds.News,
                CategoryId = textCategoryId,
                ServerId = serverId,
                CreatedAt = DateTimeOffset.UtcNow,
                ChatOrder = maxOrder + 1,
                IsPrivate = false,
            };

            context.Chats.Add(newsChat);

            var memberUsers = await context.Users
                .Where(u => context.ServerMembers.Any(m => m.ServerId == serverId && m.UserId == u.Id))
                .ToListAsync(cancellationToken);

            foreach (var user in memberUsers)
            {
                context.Members.Add(new Member
                {
                    Id = Guid.NewGuid(),
                    ChatId = newsChat.Id,
                    UserId = user.Id,
                    JoinedAt = DateTimeOffset.UtcNow,
                    Chat = newsChat,
                    User = user,
                });
            }
        }

        await context.SaveChangesAsync(cancellationToken);
    }
}
