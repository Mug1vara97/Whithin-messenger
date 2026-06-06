using MediatR;

namespace WhithinMessenger.Application.CommandsAndQueries.Auth.ChangePassword;

public record ChangePasswordCommand(Guid UserId, string CurrentPassword, string NewPassword)
    : IRequest<ChangePasswordResult>;

public record ChangePasswordResult(
    bool IsSuccess,
    string? ErrorMessage = null,
    string? ConfirmationEmail = null);
