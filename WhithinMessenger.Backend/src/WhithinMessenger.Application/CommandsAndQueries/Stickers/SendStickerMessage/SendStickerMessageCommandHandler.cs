using MediatR;
using WhithinMessenger.Application.CommandsAndQueries.Stickers;
using WhithinMessenger.Domain.Interfaces;
using WhithinMessenger.Domain.Models;

namespace WhithinMessenger.Application.CommandsAndQueries.Stickers.SendStickerMessage;

public class SendStickerMessageCommandHandler : IRequestHandler<SendStickerMessageCommand, SendStickerMessageResult>
{
    private readonly IStickerPackRepository _stickerPackRepository;
    private readonly IMessageRepository _messageRepository;
    private readonly IChatRepository _chatRepository;
    private readonly IUserRepository _userRepository;

    public SendStickerMessageCommandHandler(
        IStickerPackRepository stickerPackRepository,
        IMessageRepository messageRepository,
        IChatRepository chatRepository,
        IUserRepository userRepository)
    {
        _stickerPackRepository = stickerPackRepository;
        _messageRepository = messageRepository;
        _chatRepository = chatRepository;
        _userRepository = userRepository;
    }

    public async Task<SendStickerMessageResult> Handle(SendStickerMessageCommand request, CancellationToken cancellationToken)
    {
        try
        {
            var user = await _userRepository.GetByIdAsync(request.UserId, cancellationToken);
            if (user == null)
            {
                return new SendStickerMessageResult
                {
                    Success = false,
                    ErrorMessage = "Пользователь не найден"
                };
            }

            var chat = await _chatRepository.GetByIdAsync(request.ChatId, cancellationToken);
            if (chat == null)
            {
                return new SendStickerMessageResult
                {
                    Success = false,
                    ErrorMessage = "Чат не найден"
                };
            }

            var sticker = await _stickerPackRepository.GetStickerByIdAsync(request.StickerId, cancellationToken);
            if (sticker == null)
            {
                return new SendStickerMessageResult
                {
                    Success = false,
                    ErrorMessage = "Стикер не найден"
                };
            }

            var hasPack = await _stickerPackRepository.IsPackInstalledForUserAsync(
                request.UserId,
                sticker.StickerPackId,
                cancellationToken);
            if (!hasPack)
            {
                return new SendStickerMessageResult
                {
                    Success = false,
                    ErrorMessage = "Добавьте стикерпак в свою коллекцию"
                };
            }

            var message = new Message
            {
                Id = Guid.NewGuid(),
                ChatId = request.ChatId,
                UserId = request.UserId,
                Content = string.Empty,
                ContentType = "sticker",
                StickerId = sticker.Id,
                CreatedAt = DateTimeOffset.UtcNow,
                RepliedToMessageId = request.RepliedToMessageId
            };

            await _messageRepository.AddAsync(message, cancellationToken);

            return new SendStickerMessageResult
            {
                Success = true,
                MessageId = message.Id,
                Sticker = new StickerDto
                {
                    Id = sticker.Id,
                    StickerPackId = sticker.StickerPackId,
                    FilePath = sticker.FilePath,
                    ContentType = sticker.ContentType,
                    SortOrder = sticker.SortOrder
                }
            };
        }
        catch (Exception ex)
        {
            return new SendStickerMessageResult
            {
                Success = false,
                ErrorMessage = ex.Message
            };
        }
    }
}
