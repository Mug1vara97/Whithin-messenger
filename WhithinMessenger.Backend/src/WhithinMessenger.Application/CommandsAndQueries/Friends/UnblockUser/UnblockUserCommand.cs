using MediatR;

namespace WhithinMessenger.Application.CommandsAndQueries.Friends.UnblockUser;

public record UnblockUserCommand(Guid UserId, Guid TargetUserId) : IRequest<UnblockUserResult>;
