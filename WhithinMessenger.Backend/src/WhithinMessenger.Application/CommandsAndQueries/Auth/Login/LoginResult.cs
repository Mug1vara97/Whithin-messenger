using WhithinMessenger.Domain.Models;

namespace WhithinMessenger.Application.CommandsAndQueries.Auth.Login;

public record LoginResult(bool IsSuccess, ApplicationUser? User = null, string? ErrorMessage = null);
