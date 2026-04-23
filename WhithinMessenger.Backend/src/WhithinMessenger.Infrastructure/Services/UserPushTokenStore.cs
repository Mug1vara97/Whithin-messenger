using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using WhithinMessenger.Application.Services;
using WhithinMessenger.Infrastructure.Database;

namespace WhithinMessenger.Infrastructure.Services;

public class UserPushTokenStore : IUserPushTokenStore
{
    private const string LoginProvider = "fcm";
    private readonly WithinDbContext _context;

    public UserPushTokenStore(WithinDbContext context)
    {
        _context = context;
    }

    public async Task SaveTokenAsync(
        Guid userId,
        string deviceId,
        string token,
        CancellationToken cancellationToken = default
    )
    {
        var normalizedDeviceId = string.IsNullOrWhiteSpace(deviceId) ? "android-default" : deviceId.Trim();

        var existing = await _context.Set<IdentityUserToken<Guid>>()
            .FirstOrDefaultAsync(
                t => t.UserId == userId && t.LoginProvider == LoginProvider && t.Name == normalizedDeviceId,
                cancellationToken
            );

        if (existing == null)
        {
            _context.Set<IdentityUserToken<Guid>>().Add(new IdentityUserToken<Guid>
            {
                UserId = userId,
                LoginProvider = LoginProvider,
                Name = normalizedDeviceId,
                Value = token
            });
        }
        else
        {
            existing.Value = token;
            _context.Set<IdentityUserToken<Guid>>().Update(existing);
        }

        await _context.SaveChangesAsync(cancellationToken);
    }

    public async Task RemoveTokenAsync(
        Guid userId,
        string deviceId,
        CancellationToken cancellationToken = default
    )
    {
        var normalizedDeviceId = string.IsNullOrWhiteSpace(deviceId) ? "android-default" : deviceId.Trim();

        var existing = await _context.Set<IdentityUserToken<Guid>>()
            .FirstOrDefaultAsync(
                t => t.UserId == userId && t.LoginProvider == LoginProvider && t.Name == normalizedDeviceId,
                cancellationToken
            );

        if (existing == null)
        {
            return;
        }

        _context.Set<IdentityUserToken<Guid>>().Remove(existing);
        await _context.SaveChangesAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<string>> GetTokensAsync(
        Guid userId,
        CancellationToken cancellationToken = default
    )
    {
        return await _context.Set<IdentityUserToken<Guid>>()
            .Where(t => t.UserId == userId && t.LoginProvider == LoginProvider && !string.IsNullOrWhiteSpace(t.Value))
            .Select(t => t.Value!)
            .Distinct()
            .ToListAsync(cancellationToken);
    }
}
