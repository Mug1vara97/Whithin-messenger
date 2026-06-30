using Microsoft.EntityFrameworkCore;
using WhithinMessenger.Api.Hubs;
using WhithinMessenger.Domain.Models;
using WhithinMessenger.Infrastructure.Database;

namespace WhithinMessenger.Api.Services;

/// <summary>
/// On API startup, everyone is offline until they reconnect via SignalR.
/// </summary>
public sealed class UserPresenceStartupService : IHostedService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<UserPresenceStartupService> _logger;

    public UserPresenceStartupService(
        IServiceScopeFactory scopeFactory,
        ILogger<UserPresenceStartupService> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    public async Task StartAsync(CancellationToken cancellationToken)
    {
        NotificationHub.ResetActiveConnections();
        GroupChatHub.ResetActiveConnections();

        try
        {
            using var scope = _scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<WithinDbContext>();
            var now = DateTimeOffset.UtcNow;

            var updated = await db.Users
                .Where(user => user.Status != Status.Offline)
                .ExecuteUpdateAsync(
                    setters => setters
                        .SetProperty(user => user.Status, Status.Offline)
                        .SetProperty(user => user.LastSeen, now),
                    cancellationToken);

            _logger.LogInformation(
                "User presence reset on startup: {UpdatedCount} users marked offline",
                updated);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to reset user presence on startup");
        }
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;
}
