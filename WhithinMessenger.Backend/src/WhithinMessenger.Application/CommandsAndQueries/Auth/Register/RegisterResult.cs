namespace WhithinMessenger.Application.CommandsAndQueries.Auth.Register;

public record RegisterResult(
    bool IsSuccess,
    string? UserId = null,
    string? ErrorMessage = null,
    bool RequiresEmailConfirmation = false,
    string? Email = null);

























