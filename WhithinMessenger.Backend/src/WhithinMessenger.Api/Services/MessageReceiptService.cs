using Microsoft.AspNetCore.SignalR;
using WhithinMessenger.Api.Hubs;
using WhithinMessenger.Domain.Interfaces;
using WhithinMessenger.Domain.Models;

namespace WhithinMessenger.Api.Services;

public interface IMessageReceiptService
{
    Task AutoDeliverToReachableRecipientsAsync(
        Guid chatId,
        Guid messageId,
        Guid senderUserId,
        CancellationToken cancellationToken = default);

    Task BroadcastMessageStatusAsync(
        Guid chatId,
        Guid messageId,
        CancellationToken cancellationToken = default);

    Task AcknowledgePendingDeliveriesForUserAsync(
        Guid userId,
        CancellationToken cancellationToken = default);
}

public class MessageReceiptService : IMessageReceiptService
{
    private readonly IChatRepository _chatRepository;
    private readonly IUserRepository _userRepository;
    private readonly IMessageRepository _messageRepository;
    private readonly IHubContext<GroupChatHub> _groupChatHub;

    public MessageReceiptService(
        IChatRepository chatRepository,
        IUserRepository userRepository,
        IMessageRepository messageRepository,
        IHubContext<GroupChatHub> groupChatHub)
    {
        _chatRepository = chatRepository;
        _userRepository = userRepository;
        _messageRepository = messageRepository;
        _groupChatHub = groupChatHub;
    }

    public async Task AutoDeliverToReachableRecipientsAsync(
        Guid chatId,
        Guid messageId,
        Guid senderUserId,
        CancellationToken cancellationToken = default)
    {
        var memberIds = await _chatRepository.GetChatMembersAsync(chatId, cancellationToken);
        foreach (var memberId in memberIds.Where(id => id != senderUserId))
        {
            if (!await IsRecipientReachableAsync(memberId, cancellationToken))
            {
                continue;
            }

            await _messageRepository.MarkMessageDeliveredAsync(messageId, memberId, cancellationToken);
        }

        await BroadcastMessageStatusAsync(chatId, messageId, cancellationToken);
    }

    public async Task AcknowledgePendingDeliveriesForUserAsync(
        Guid userId,
        CancellationToken cancellationToken = default)
    {
        var receipts = await _messageRepository.AcknowledgePendingDeliveriesForUserAsync(userId, cancellationToken);
        foreach (var receipt in receipts)
        {
            await BroadcastMessageStatusAsync(receipt.ChatId, receipt.MessageId, cancellationToken);
        }
    }

    public async Task BroadcastMessageStatusAsync(
        Guid chatId,
        Guid messageId,
        CancellationToken cancellationToken = default)
    {
        var senderUserId = await _messageRepository.GetSenderUserIdAsync(messageId, cancellationToken);
        if (senderUserId == null)
        {
            return;
        }

        var chatMembers = await _chatRepository.GetChatMembersAsync(chatId, cancellationToken);
        var recipientCount = Math.Max(0, chatMembers.Count - 1);
        if (recipientCount <= 0)
        {
            return;
        }

        var status = await _messageRepository.GetMessageStatusAsync(
            messageId,
            senderUserId.Value,
            recipientCount,
            cancellationToken);

        if (string.IsNullOrEmpty(status))
        {
            return;
        }

        await _groupChatHub.Clients.Group(chatId.ToString())
            .SendAsync("MessageStatusChanged", messageId, status, cancellationToken);
    }

    private async Task<bool> IsRecipientReachableAsync(Guid userId, CancellationToken cancellationToken)
    {
        if (NotificationHub.HasActiveConnection(userId) || GroupChatHub.HasActiveConnection(userId))
        {
            return true;
        }

        var user = await _userRepository.GetByIdAsync(userId, cancellationToken);
        return user != null && user.Status != Status.Offline;
    }
}
