using MediatR;

namespace WhithinMessenger.Application.CommandsAndQueries.Auth.Register;

public record RegisterCommand(string Username, string Password, string Email) : IRequest<RegisterResult>;

























