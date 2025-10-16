using Microsoft.EntityFrameworkCore;
using WhithinMessenger.Domain.Interfaces;
using WhithinMessenger.Domain.Models;
using WhithinMessenger.Infrastructure.Database;

namespace WhithinMessenger.Infrastructure.Repositories;

public class CategoryRepository : ICategoryRepository
{
    private readonly WithinDbContext _context;

    public CategoryRepository(WithinDbContext context)
    {
        _context = context;
    }

    public async Task<ChatCategory?> GetByIdAsync(Guid categoryId, CancellationToken cancellationToken = default)
    {
        return await _context.ChatCategories
            .Include(c => c.Chats)
            .FirstOrDefaultAsync(c => c.Id == categoryId, cancellationToken);
    }

    public async Task<List<ChatCategory>> GetByServerIdAsync(Guid serverId, CancellationToken cancellationToken = default)
    {
        return await _context.ChatCategories
            .Where(c => c.ServerId == serverId)
            .Include(c => c.Chats)
            .OrderBy(c => c.CategoryOrder)
            .ToListAsync(cancellationToken);
    }

    public async Task<ChatCategory> CreateAsync(ChatCategory category, CancellationToken cancellationToken = default)
    {
        _context.ChatCategories.Add(category);
        await _context.SaveChangesAsync(cancellationToken);
        return category;
    }

    public async Task<ChatCategory> UpdateAsync(ChatCategory category, CancellationToken cancellationToken = default)
    {
        _context.ChatCategories.Update(category);
        await _context.SaveChangesAsync(cancellationToken);
        return category;
    }

    public async Task DeleteAsync(Guid categoryId, CancellationToken cancellationToken = default)
    {
        var category = await GetByIdAsync(categoryId, cancellationToken);
        if (category != null)
        {
            _context.ChatCategories.Remove(category);
            await _context.SaveChangesAsync(cancellationToken);
        }
    }

    public async Task DeleteAllByServerIdAsync(Guid serverId, CancellationToken cancellationToken = default)
    {
        var categories = await _context.ChatCategories
            .Where(c => c.ServerId == serverId)
            .ToListAsync(cancellationToken);

        if (categories.Any())
        {
            _context.ChatCategories.RemoveRange(categories);
            await _context.SaveChangesAsync(cancellationToken);
        }
    }

    public async Task<bool> ExistsAsync(Guid serverId, string categoryName, CancellationToken cancellationToken = default)
    {
        return await _context.ChatCategories
            .AnyAsync(c => c.ServerId == serverId && c.CategoryName == categoryName, cancellationToken);
    }
}
