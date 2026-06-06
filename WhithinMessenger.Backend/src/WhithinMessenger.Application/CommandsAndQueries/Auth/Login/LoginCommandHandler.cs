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

        if (!await IsPasswordValidAsync(user, request.Password))
        {
            return new LoginResult(false, ErrorMessage: "Неверный пароль");
        }

        if (!user.EmailConfirmed)
        {
            return new LoginResult(
                false,
                ErrorMessage: "Подтвердите email. Проверьте почту или запросите письмо повторно.",
                RequiresEmailConfirmation: true,
                Email: user.Email);
        }

        return new LoginResult(true, User: user);
    }

    private async Task<bool> IsPasswordValidAsync(ApplicationUser user, string password)
    {
        if (await _userManager.CheckPasswordAsync(user, password))
        {
            return true;
        }

        // Legacy accounts created before Identity password hashing.
        if (user.PasswordHash == password)
        {
            var resetToken = await _userManager.GeneratePasswordResetTokenAsync(user);
            var resetResult = await _userManager.ResetPasswordAsync(user, resetToken, password);
            return resetResult.Succeeded;
        }

        return false;
    }
}
