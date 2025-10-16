using MediatR;

namespace WhithinMessenger.Application.CommandsAndQueries.Servers.AddMember;

public record AddMemberCommand(Guid ServerId, Guid UserId) : IRequest<AddMemberResult>;
