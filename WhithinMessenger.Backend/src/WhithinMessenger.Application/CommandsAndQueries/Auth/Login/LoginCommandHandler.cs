using MediatR;
using Microsoft.AspNetCore.Identity;
using WhithinMessenger.Domain.Models;

namespace WhithinMessenger.Application.CommandsAndQueries.Auth.Login;

public class LoginCommandHandler : IRequestHandler<LoginCommand, LoginResult>
{
    private readonly UserManager<ApplicationUser> _userManager;

    public LoginCommandHandler(UserManager<ApplicationUser> userManager)
    {
        _userManager = userManager;
    }

    public async Task<LoginResult> Handle(LoginCommand request, CancellationToken cancellationToken)
    {
        var user = await _userManager.FindByNameAsync(request.Username);
        
        if (user == null)
        {
            return new LoginResult(false, ErrorMessage: "Пользователь не найден");
        }

        if (user.PasswordHash != request.Password)
        {
            return new LoginResult(false, ErrorMessage: "Неверный пароль");
        }

        return new LoginResult(true, User: user);
    }
}
