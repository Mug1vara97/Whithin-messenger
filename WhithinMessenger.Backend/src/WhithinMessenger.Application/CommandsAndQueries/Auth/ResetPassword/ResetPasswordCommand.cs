using MediatR;

namespace WhithinMessenger.Application.CommandsAndQueries.Auth.ResetPassword;

public record ResetPasswordCommand(Guid UserId, string Token, string NewPassword)
    : IRequest<ResetPasswordResult>;

public record ResetPasswordResult(bool IsSuccess, string? ErrorMessage = null);
