using MediatR;

namespace WhithinMessenger.Application.CommandsAndQueries.Auth.ChangeEmail;

public record ChangeEmailCommand(Guid UserId, string NewEmail, string CurrentPassword)
    : IRequest<ChangeEmailResult>;

public record ChangeEmailResult(bool IsSuccess, string? ErrorMessage = null, string? PendingEmail = null);
