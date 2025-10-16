using WhithinMessenger.Domain.Interfaces;
using WhithinMessenger.Application.DTOs;

namespace WhithinMessenger.Application.CommandsAndQueries.Users.SearchUsers
{
    public record SearchUsersResult
    {
        public List<UserSearchInfo> Users { get; init; } = new();
        public bool Success { get; init; }
        public string? ErrorMessage { get; init; }
    }
}