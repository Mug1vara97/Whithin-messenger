using WhithinMessenger.Domain.Interfaces;

namespace WhithinMessenger.Application.CommandsAndQueries.Chats.GetAvailableUsers
{
    public record GetAvailableUsersResult
    {
        public bool Success { get; init; }
        public string? ErrorMessage { get; init; }
        public List<AvailableUserInfo> AvailableUsers { get; init; } = new();
    }
}










