using MediatR;

namespace WhithinMessenger.Application.CommandsAndQueries.Servers.LeaveServer;

public record LeaveServerCommand(Guid ServerId, Guid UserId) : IRequest<LeaveServerResult>;

