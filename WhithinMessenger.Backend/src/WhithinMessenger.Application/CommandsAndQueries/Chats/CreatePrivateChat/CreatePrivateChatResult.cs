using WhithinMessenger.Domain.Interfaces;

namespace WhithinMessenger.Application.CommandsAndQueries.Chats.CreatePrivateChat
{
    public record CreatePrivateChatResult : ICreatePrivateChatResult
    {
        public Guid ChatId { get; init; }
        public bool Exists { get; init; }
        public bool Success { get; init; }
        public string? ErrorMessage { get; init; }
    }
}
