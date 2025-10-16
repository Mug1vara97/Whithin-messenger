using WhithinMessenger.Domain.Interfaces;

namespace WhithinMessenger.Application.CommandsAndQueries.Chats.GetUserChats
{
    public record GetUserChatsResult
    {
        public List<ChatInfo> Chats { get; init; } = new();
    }
}
