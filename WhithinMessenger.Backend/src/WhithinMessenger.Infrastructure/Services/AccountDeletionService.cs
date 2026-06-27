using MediatR;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using WhithinMessenger.Application.CommandsAndQueries.Servers.DeleteServer;
using WhithinMessenger.Application.Services;
using WhithinMessenger.Domain.Interfaces;
using WhithinMessenger.Domain.Models;
using WhithinMessenger.Infrastructure.Database;

namespace WhithinMessenger.Infrastructure.Services;

public class AccountDeletionService : IAccountDeletionService
{
    private readonly WithinDbContext _context;
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly IMediator _mediator;
    private readonly IChatRepository _chatRepository;
    private readonly IStickerPackRepository _stickerPackRepository;
    private readonly IFileService _fileService;
    private readonly IUserListCacheService _userListCacheService;

    public AccountDeletionService(
        WithinDbContext context,
        UserManager<ApplicationUser> userManager,
        IMediator mediator,
        IChatRepository chatRepository,
        IStickerPackRepository stickerPackRepository,
        IFileService fileService,
        IUserListCacheService userListCacheService)
    {
        _context = context;
        _userManager = userManager;
        _mediator = mediator;
        _chatRepository = chatRepository;
        _stickerPackRepository = stickerPackRepository;
        _fileService = fileService;
        _userListCacheService = userListCacheService;
    }

    public async Task<AccountDeletionResult> DeleteAccountAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        var user = await _userManager.FindByIdAsync(userId.ToString());
        if (user == null)
        {
            return new AccountDeletionResult(false, "Пользователь не найден");
        }

        await using var transaction = await _context.Database.BeginTransactionAsync(cancellationToken);

        try
        {
            var cacheInvalidationUserIds = new HashSet<Guid> { userId };

            await DeleteOwnedStickerPacksAsync(userId, cancellationToken);
            await DeleteProfileAssetsAsync(userId, cancellationToken);

            var ownedServerIds = await _context.Servers
                .AsNoTracking()
                .Where(server => server.OwnerId == userId)
                .Select(server => server.Id)
                .ToListAsync(cancellationToken);

            foreach (var serverId in ownedServerIds)
            {
                var deleteServerResult = await _mediator.Send(
                    new DeleteServerCommand(serverId, userId),
                    cancellationToken);

                if (!deleteServerResult.Success)
                {
                    throw new InvalidOperationException(deleteServerResult.ErrorMessage ?? "Не удалось удалить сервер");
                }
            }

            var chatsToDelete = await (
                from member in _context.Members.AsNoTracking()
                join chat in _context.Chats.AsNoTracking() on member.ChatId equals chat.Id
                join chatType in _context.ChatTypes.AsNoTracking() on chat.TypeId equals chatType.Id
                where member.UserId == userId && chat.ServerId == null
                select new { chat.Id, chatType.TypeName }
            ).ToListAsync(cancellationToken);

            foreach (var chat in chatsToDelete)
            {
                if (chat.TypeName is not (ChatTypeNames.Private or ChatTypeNames.Saved))
                {
                    continue;
                }

                var participants = await _context.Members
                    .AsNoTracking()
                    .Where(member => member.ChatId == chat.Id)
                    .Select(member => member.UserId)
                    .ToListAsync(cancellationToken);

                foreach (var participantId in participants)
                {
                    cacheInvalidationUserIds.Add(participantId);
                }

                await _chatRepository.DeleteAsync(chat.Id, cancellationToken);
            }

            await _context.PendingPasswordChanges
                .Where(item => item.UserId == userId)
                .ExecuteDeleteAsync(cancellationToken);

            await _context.PendingPasswordResets
                .Where(item => item.UserId == userId)
                .ExecuteDeleteAsync(cancellationToken);

            var deleteResult = await _userManager.DeleteAsync(user);
            if (!deleteResult.Succeeded)
            {
                var errorMessage = string.Join("; ", deleteResult.Errors.Select(error => error.Description));
                throw new InvalidOperationException(errorMessage);
            }

            await transaction.CommitAsync(cancellationToken);

            foreach (var affectedUserId in cacheInvalidationUserIds)
            {
                await _userListCacheService.InvalidateUserChatsAsync([affectedUserId], cancellationToken);
                await _userListCacheService.InvalidateUserServersAsync(affectedUserId, cancellationToken);
            }

            return new AccountDeletionResult(true, null);
        }
        catch (Exception ex)
        {
            await transaction.RollbackAsync(cancellationToken);
            return new AccountDeletionResult(false, ex.Message);
        }
    }

    private async Task DeleteOwnedStickerPacksAsync(Guid userId, CancellationToken cancellationToken)
    {
        var ownedPackIds = await _context.StickerPacks
            .AsNoTracking()
            .Where(pack => pack.CreatedByUserId == userId)
            .Select(pack => pack.Id)
            .ToListAsync(cancellationToken);

        foreach (var packId in ownedPackIds)
        {
            var pack = await _stickerPackRepository.GetByIdWithStickersAsync(packId, cancellationToken);
            if (pack == null)
            {
                continue;
            }

            foreach (var sticker in pack.Stickers)
            {
                if (!string.IsNullOrWhiteSpace(sticker.FilePath))
                {
                    await _fileService.DeleteFileAsync(NormalizeStoredPath(sticker.FilePath), cancellationToken);
                }
            }

            var packFolder = _fileService.GetFullPathForFolder($"stickers/{pack.Id}");
            if (Directory.Exists(packFolder))
            {
                try
                {
                    Directory.Delete(packFolder, recursive: true);
                }
                catch
                {
                    // Файлы уже удалены по одному.
                }
            }

            await _stickerPackRepository.DeletePackAsync(packId, cancellationToken);
        }
    }

    private async Task DeleteProfileAssetsAsync(Guid userId, CancellationToken cancellationToken)
    {
        var profile = await _context.UserProfiles
            .AsNoTracking()
            .FirstOrDefaultAsync(item => item.UserId == userId, cancellationToken);

        if (profile == null)
        {
            return;
        }

        await TryDeleteStoredAssetAsync(profile.Avatar, cancellationToken);
        await TryDeleteStoredAssetAsync(profile.Banner, cancellationToken);
        await TryDeleteStoredAssetAsync(profile.Nameplate, cancellationToken);
        await TryDeleteStoredAssetAsync(profile.AvatarDecoration, cancellationToken);
    }

    private async Task TryDeleteStoredAssetAsync(string? storedPath, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(storedPath) || storedPath.StartsWith("#", StringComparison.Ordinal))
        {
            return;
        }

        await _fileService.DeleteFileAsync(NormalizeStoredPath(storedPath), cancellationToken);
    }

    private static string NormalizeStoredPath(string filePath)
    {
        var normalized = filePath.Replace("\\", "/").TrimStart('/');
        return normalized.StartsWith("uploads/", StringComparison.OrdinalIgnoreCase)
            ? normalized
            : $"uploads/{normalized}";
    }
}
