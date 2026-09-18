using System.Collections.Concurrent;
using MediatR;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using WhithinMessenger.Api.Services;
using WhithinMessenger.Application.Services;
using WhithinMessenger.Domain.Interfaces;
using WhithinMessenger.Domain.Models;
using WhithinMessenger.Infrastructure.Database;

namespace WhithinMessenger.Api.Hubs;

/// <summary>
/// Единый SignalR-хаб приложения. Один WebSocket на клиента; доменная логика разнесена
/// по partial-файлам: AppHub.Chat, AppHub.ChatList, AppHub.Server, AppHub.ServerList,
/// AppHub.Friend, AppHub.Notification.
///
/// Правила:
///  - имена групп только через <see cref="HubGroups"/>;
///  - имена методов и клиентских событий уникальны в рамках всего хаба
///    (SignalR сопоставляет их без учёта регистра);
///  - userId берём из JWT-claim "UserId", fallback — query ?userId= (legacy-клиенты).
/// </summary>
public partial class AppHub : Hub
{
    private static readonly ConcurrentDictionary<Guid, int> ActiveConnections = new();

    public static bool HasActiveConnection(Guid userId) =>
        ActiveConnections.TryGetValue(userId, out var count) && count > 0;

    public static void ResetActiveConnections() => ActiveConnections.Clear();

    private readonly IMediator _mediator;
    private readonly ILogger<AppHub> _logger;
    private readonly INotificationService _notificationService;
    private readonly IChatRepository _chatRepository;
    private readonly IMessageRepository _messageRepository;
    private readonly IUserRepository _userRepository;
    private readonly IServerRepository _serverRepository;
    private readonly IServerMemberRepository _serverMemberRepository;
    private readonly ChatMessageNotificationService _chatMessageNotificationService;
    private readonly IMessageReceiptService _messageReceiptService;
    private readonly IUserPresenceBroadcastService _presenceBroadcast;
    private readonly ServerPermissionChecker _permissionChecker;
    private readonly WithinDbContext _dbContext;

    public AppHub(
        IMediator mediator,
        ILogger<AppHub> logger,
        INotificationService notificationService,
        IChatRepository chatRepository,
        IMessageRepository messageRepository,
        IUserRepository userRepository,
        IServerRepository serverRepository,
        IServerMemberRepository serverMemberRepository,
        ChatMessageNotificationService chatMessageNotificationService,
        IMessageReceiptService messageReceiptService,
        IUserPresenceBroadcastService presenceBroadcast,
        ServerPermissionChecker permissionChecker,
        WithinDbContext dbContext)
    {
        _mediator = mediator;
        _logger = logger;
        _notificationService = notificationService;
        _chatRepository = chatRepository;
        _messageRepository = messageRepository;
        _userRepository = userRepository;
        _serverRepository = serverRepository;
        _serverMemberRepository = serverMemberRepository;
        _chatMessageNotificationService = chatMessageNotificationService;
        _messageReceiptService = messageReceiptService;
        _presenceBroadcast = presenceBroadcast;
        _permissionChecker = permissionChecker;
        _dbContext = dbContext;
    }

    // ----------------------------------------------------------------------
    // Lifecycle
    // ----------------------------------------------------------------------

    public override async Task OnConnectedAsync()
    {
        var userId = GetCurrentUserId();
        if (userId.HasValue)
        {
            ActiveConnections.AddOrUpdate(userId.Value, 1, (_, current) => current + 1);
            await Groups.AddToGroupAsync(Context.ConnectionId, HubGroups.User(userId.Value));

            // Не форсируем Offline → Online: клиент сам восстанавливает выбранный статус
            // (включая Invisible / Offline) через PUT /api/user/status после подключения.

            try
            {
                await _messageReceiptService.AcknowledgePendingDeliveriesForUserAsync(userId.Value);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to acknowledge pending deliveries for user {UserId}", userId);
            }
        }

        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        var userId = GetCurrentUserId();
        if (userId.HasValue)
        {
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, HubGroups.User(userId.Value));

            var hasOtherConnections = DecrementConnectionCount(userId.Value);
            if (!hasOtherConnections)
            {
                try
                {
                    await MarkUserOfflineAsync(userId.Value);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Failed to mark user {UserId} offline", userId);
                }
            }
        }

        await base.OnDisconnectedAsync(exception);
    }

    private static bool DecrementConnectionCount(Guid userId)
    {
        if (!ActiveConnections.TryGetValue(userId, out var current))
        {
            return false;
        }

        if (current <= 1)
        {
            ActiveConnections.TryRemove(userId, out _);
            return false;
        }

        ActiveConnections.TryUpdate(userId, current - 1, current);
        return true;
    }

    private async Task MarkUserOfflineAsync(Guid userId)
    {
        var user = await _dbContext.Users.FirstOrDefaultAsync(u => u.Id == userId);
        if (user == null)
        {
            return;
        }

        if (user.Status != Status.Offline)
        {
            user.Status = Status.Offline;
            user.LastSeen = DateTimeOffset.UtcNow;
            await _dbContext.SaveChangesAsync();
        }

        await _presenceBroadcast.BroadcastStatusChangedAsync(userId, user.Status, user.LastSeen);
    }

    // ----------------------------------------------------------------------
    // Identity helpers
    // ----------------------------------------------------------------------

    private Guid? GetCurrentUserId()
    {
        var userIdClaim = Context.User?.FindFirst("UserId")?.Value;
        if (Guid.TryParse(userIdClaim, out var userId))
        {
            return userId;
        }

        // Fallback на query parameter (legacy-клиенты без access_token)
        var userIdFromQuery = Context.GetHttpContext()?.Request.Query["userId"].FirstOrDefault();
        if (Guid.TryParse(userIdFromQuery, out var userIdFromQueryParsed))
        {
            return userIdFromQueryParsed;
        }

        return null;
    }

    private Guid GetCurrentUserIdOrThrow()
    {
        var userId = GetCurrentUserId();
        if (!userId.HasValue)
        {
            throw new HubException("Пользователь не авторизован");
        }

        return userId.Value;
    }
}
