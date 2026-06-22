using Microsoft.EntityFrameworkCore;
using WhithinMessenger.Domain.Models;

namespace WhithinMessenger.Infrastructure.Database;

/// <summary>
/// Idempotent data fix after <c>FixSavedMessagesChatTypeId</c> schema migration (seed insert).
/// </summary>
public static class SavedMessagesChatTypeDataFix
{
    public static async Task ApplyAsync(WithinDbContext context, CancellationToken cancellationToken = default)
    {
        var ideasBoardType = await context.ChatTypes
            .FirstOrDefaultAsync(t => t.Id == ChatTypeIds.IdeasBoard, cancellationToken);

        if (ideasBoardType is { TypeName: ChatTypeNames.Saved })
        {
            ideasBoardType.TypeName = ChatTypeNames.IdeasBoard;
            await context.SaveChangesAsync(cancellationToken);
        }

        var savedTypeExists = await context.ChatTypes
            .AnyAsync(t => t.Id == ChatTypeIds.Saved, cancellationToken);

        if (!savedTypeExists)
        {
            return;
        }

        var personalLegacyChatIds = await context.Chats
            .AsNoTracking()
            .Where(c => c.TypeId == ChatTypeIds.IdeasBoard && c.ServerId == null)
            .Select(c => new
            {
                c.Id,
                MemberCount = context.Members.Count(m => m.ChatId == c.Id),
            })
            .Where(x => x.MemberCount == 1)
            .Select(x => x.Id)
            .ToListAsync(cancellationToken);

        if (personalLegacyChatIds.Count == 0)
        {
            return;
        }

        await context.Chats
            .Where(c => personalLegacyChatIds.Contains(c.Id))
            .ExecuteUpdateAsync(
                setters => setters.SetProperty(c => c.TypeId, ChatTypeIds.Saved),
                cancellationToken);
    }
}
