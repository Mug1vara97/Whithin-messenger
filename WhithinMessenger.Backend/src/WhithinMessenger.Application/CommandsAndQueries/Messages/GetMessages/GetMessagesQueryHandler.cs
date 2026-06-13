using MediatR;
using WhithinMessenger.Domain.Interfaces;

namespace WhithinMessenger.Application.CommandsAndQueries.Messages.GetMessages;

public class GetMessagesQueryHandler : IRequestHandler<GetMessagesQuery, GetMessagesResult>
{
    private readonly IMessageRepository _messageRepository;
    private readonly IChatRepository _chatRepository;

    public GetMessagesQueryHandler(IMessageRepository messageRepository, IChatRepository chatRepository)
    {
        _messageRepository = messageRepository;
        _chatRepository = chatRepository;
    }

    public async Task<GetMessagesResult> Handle(GetMessagesQuery request, CancellationToken cancellationToken)
    {
        try
        {
            var limit = request.Limit > 0 ? request.Limit : 0;
            var messages = limit > 0
                ? await _messageRepository.GetByChatIdPageAsync(
                    request.ChatId,
                    limit,
                    request.BeforeMessageId,
                    cancellationToken)
                : await _messageRepository.GetByChatIdAsync(request.ChatId, cancellationToken);

            var hasMoreOlder = false;
            if (limit > 0 && messages.Count == limit)
            {
                hasMoreOlder = await _messageRepository.HasOlderMessagesAsync(
                    request.ChatId,
                    messages[0].Id,
                    cancellationToken);
            }

            var chatMembers = await _chatRepository.GetChatMembersAsync(request.ChatId, cancellationToken);
            var recipientCount = Math.Max(0, chatMembers.Count - 1);

            Dictionary<Guid, string> statuses = new();
            if (request.UserId.HasValue && recipientCount > 0)
            {
                var ownMessageIds = messages
                    .Where(m => m.UserId == request.UserId.Value)
                    .Select(m => m.Id)
                    .ToList();

                statuses = await _messageRepository.GetMessageStatusesAsync(
                    request.UserId.Value,
                    ownMessageIds,
                    recipientCount,
                    cancellationToken);
            }

            var messageDtos = messages.Select(m =>
            {
                var dto = MessageDtoMapper.Map(m, request.UserId);
                if (request.UserId.HasValue && m.UserId == request.UserId.Value)
                {
                    dto.Status = statuses.GetValueOrDefault(m.Id, MessageStatusHelper.Sent);
                }
                return dto;
            }).ToList();

            return new GetMessagesResult
            {
                Success = true,
                Messages = messageDtos,
                HasMoreOlder = hasMoreOlder,
            };
        }
        catch (Exception ex)
        {
            return new GetMessagesResult
            {
                Success = false,
                ErrorMessage = ex.Message
            };
        }
    }
}
