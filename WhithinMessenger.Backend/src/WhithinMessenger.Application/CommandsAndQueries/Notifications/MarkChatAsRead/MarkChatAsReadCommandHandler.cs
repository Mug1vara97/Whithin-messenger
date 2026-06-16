using MediatR;
using Microsoft.AspNetCore.SignalR;
using WhithinMessenger.Application.Services;
using WhithinMessenger.Domain.Interfaces;

namespace WhithinMessenger.Application.CommandsAndQueries.Notifications.MarkChatAsRead;

public class MarkChatAsReadCommandHandler : IRequestHandler<MarkChatAsReadCommand, MarkChatAsReadResult>
{
    private readonly INotificationRepository _notificationRepository;
    private readonly IHubContext<Hub> _notificationHub;
    private readonly INotificationService _notificationService;
    private readonly IMessageRepository _messageRepository;
    private readonly IUserListCacheService _userListCache;

    public MarkChatAsReadCommandHandler(
        INotificationRepository notificationRepository,
        IHubContext<Hub> notificationHub,
        INotificationService notificationService,
        IMessageRepository messageRepository,
        IUserListCacheService userListCache)
    {
        _notificationRepository = notificationRepository;
        _notificationHub = notificationHub;
        _notificationService = notificationService;
        _messageRepository = messageRepository;
        _userListCache = userListCache;
    }

    public async Task<MarkChatAsReadResult> Handle(MarkChatAsReadCommand request, CancellationToken cancellationToken)
    {
        try
        {
            var markedMessages = await _messageRepository.MarkChatAsReadAsync(request.ChatId, request.UserId, cancellationToken);

            await _notificationRepository.MarkChatAsReadAsync(request.ChatId, request.UserId, cancellationToken);

            var notificationUnreadCount = await _notificationService.GetUnreadCountForUserAsync(request.UserId, cancellationToken);
            await _notificationHub.Clients.User(request.UserId.ToString())
                .SendAsync("UnreadCountChanged", notificationUnreadCount, cancellationToken);
            await _notificationHub.Clients.User(request.UserId.ToString())
                .SendAsync("ChatNotificationsDismissed", new { chatId = request.ChatId }, cancellationToken);

            await _userListCache.InvalidateUserChatsAsync(request.UserId, cancellationToken);

            return new MarkChatAsReadResult
            {
                Success = true,
                MarkedCount = markedMessages.Count,
                MarkedMessages = markedMessages
            };
        }
        catch (Exception ex)
        {
            return new MarkChatAsReadResult
            {
                Success = false,
                ErrorMessage = ex.Message
            };
        }
    }
}
