using WhithinMessenger.Domain.Interfaces;

namespace WhithinMessenger.Application.CommandsAndQueries.Chats.GetChatParticipants
{
    public record GetChatParticipantsResult
    {
        public bool Success { get; init; }
        public string? ErrorMessage { get; init; }
        public List<ChatParticipantInfo> Participants { get; init; } = new();
    }
}
