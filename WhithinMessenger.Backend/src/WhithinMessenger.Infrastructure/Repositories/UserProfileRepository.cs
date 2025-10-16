using Microsoft.EntityFrameworkCore;
using WhithinMessenger.Domain.Interfaces;
using WhithinMessenger.Domain.Models;
using WhithinMessenger.Infrastructure.Database;

namespace WhithinMessenger.Infrastructure.Repositories;

public class UserProfileRepository : IUserProfileRepository
{
    private readonly WithinDbContext _context;

    public UserProfileRepository(WithinDbContext context)
    {
        _context = context;
    }

    public async Task<UserProfile?> GetByUserIdAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        return await _context.UserProfiles
            .FirstOrDefaultAsync(up => up.UserId == userId, cancellationToken);
    }

    public async Task<UserProfile> CreateAsync(UserProfile userProfile, CancellationToken cancellationToken = default)
    {
        _context.UserProfiles.Add(userProfile);
        await _context.SaveChangesAsync(cancellationToken);
        return userProfile;
    }

    public async Task<UserProfile> UpdateAsync(UserProfile userProfile, CancellationToken cancellationToken = default)
    {
        _context.UserProfiles.Update(userProfile);
        await _context.SaveChangesAsync(cancellationToken);
        return userProfile;
    }

    public async Task DeleteAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        var userProfile = await _context.UserProfiles
            .FirstOrDefaultAsync(up => up.UserId == userId, cancellationToken);
        
        if (userProfile != null)
        {
            _context.UserProfiles.Remove(userProfile);
            await _context.SaveChangesAsync(cancellationToken);
        }
    }
}









