using MediatR;

namespace WhithinMessenger.Application.CommandsAndQueries.Auth.ConfirmEmail;

public record ConfirmEmailCommand(Guid UserId, string Token) : IRequest<ConfirmEmailResult>;

public record ConfirmEmailResult(bool IsSuccess, string? ErrorMessage = null);
