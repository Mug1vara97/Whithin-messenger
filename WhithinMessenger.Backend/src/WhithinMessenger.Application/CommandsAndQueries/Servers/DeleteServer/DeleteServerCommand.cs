using MediatR;

namespace WhithinMessenger.Application.CommandsAndQueries.Servers.DeleteServer;

public record DeleteServerCommand(Guid ServerId, Guid UserId) : IRequest<DeleteServerResult>;

