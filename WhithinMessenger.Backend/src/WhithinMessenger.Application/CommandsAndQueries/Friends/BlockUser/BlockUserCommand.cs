using MediatR;

namespace WhithinMessenger.Application.CommandsAndQueries.Friends.BlockUser;

public record BlockUserCommand(Guid UserId, Guid TargetUserId) : IRequest<BlockUserResult>;
