using MediatR;

namespace WhithinMessenger.Application.CommandsAndQueries.Auth.ForgotPassword;

public record ForgotPasswordCommand(string Email)
    : IRequest<ForgotPasswordResult>;

public record ForgotPasswordResult(bool IsSuccess, string? ErrorMessage = null);
