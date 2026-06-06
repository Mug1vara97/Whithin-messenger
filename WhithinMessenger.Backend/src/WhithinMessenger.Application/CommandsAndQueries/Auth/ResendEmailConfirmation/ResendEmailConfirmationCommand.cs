using MediatR;

namespace WhithinMessenger.Application.CommandsAndQueries.Auth.ResendEmailConfirmation;

public record ResendEmailConfirmationCommand(string Email) : IRequest<ResendEmailConfirmationResult>;

public record ResendEmailConfirmationResult(bool IsSuccess, string? ErrorMessage = null);
