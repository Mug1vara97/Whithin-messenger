using MediatR;

namespace WhithinMessenger.Application.CommandsAndQueries.Users.DeleteAccount;

public record DeleteAccountCommand(Guid UserId, string Password) : IRequest<DeleteAccountResult>;

public record DeleteAccountResult(bool Success, string? ErrorMessage);
