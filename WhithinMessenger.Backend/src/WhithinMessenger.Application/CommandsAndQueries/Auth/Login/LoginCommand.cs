using MediatR;

namespace WhithinMessenger.Application.CommandsAndQueries.Auth.Login;

public record LoginCommand(string Username, string Password) : IRequest<LoginResult>;

























