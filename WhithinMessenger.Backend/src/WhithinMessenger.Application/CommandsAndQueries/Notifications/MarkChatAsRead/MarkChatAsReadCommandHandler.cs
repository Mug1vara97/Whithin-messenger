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

    public MarkChatAsReadCommandHandler(
        INotificationRepository notificationRepository,
        IHubContext<Hub> notificationHub,
        INotificationService notificationService,
        IMessageRepository messageRepository)
    {
        _notificationRepository = notificationRepository;
        _notificationHub = notificationHub;
        _notificationService = notificationService;
        _messageRepository = messageRepository;
    }

    public async Task<MarkChatAsReadResult> Handle(MarkChatAsReadCommand request, CancellationToken cancellationToken)
    {
        try
        {
            var unreadBefore = await _messageRepository.GetUnreadCountByChatAsync(request.ChatId, request.UserId, cancellationToken);
            await _messageRepository.MarkChatAsReadAsync(request.ChatId, request.UserId, cancellationToken);

            await _notificationRepository.MarkChatAsReadAsync(request.ChatId, request.UserId, cancellationToken);

            var unreadAfter = await _messageRepository.GetUnreadCountByChatAsync(request.ChatId, request.UserId, cancellationToken);

            var notificationUnreadCount = await _notificationService.GetUnreadCountForUserAsync(request.UserId, cancellationToken);
            await _notificationHub.Clients.User(request.UserId.ToString())
                .SendAsync("UnreadCountChanged", notificationUnreadCount, cancellationToken);

            return new MarkChatAsReadResult
            {
                Success = true,
                MarkedCount = Math.Max(0, unreadBefore - unreadAfter)
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

