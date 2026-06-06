using MediatR;

namespace WhithinMessenger.Application.CommandsAndQueries.Auth.ConfirmEmailChange;

public record ConfirmEmailChangeCommand(Guid UserId, string NewEmail, string Token)
    : IRequest<ConfirmEmailChangeResult>;

public record ConfirmEmailChangeResult(bool IsSuccess, string? ErrorMessage = null, string? Email = null);
