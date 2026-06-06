using MediatR;

namespace WhithinMessenger.Application.CommandsAndQueries.Auth.ConfirmPasswordChange;

public record ConfirmPasswordChangeCommand(Guid UserId, string Token)
    : IRequest<ConfirmPasswordChangeResult>;

public record ConfirmPasswordChangeResult(bool IsSuccess, string? ErrorMessage = null);
