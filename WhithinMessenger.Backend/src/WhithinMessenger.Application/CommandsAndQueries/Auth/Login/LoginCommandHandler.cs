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
        if (IsLegacyPlainTextPasswordHash(user.PasswordHash))
        {
            if (user.PasswordHash != password)
            {
                return false;
            }

            user.PasswordHash = _userManager.PasswordHasher.HashPassword(user, password);
            var updateResult = await _userManager.UpdateAsync(user);
            return updateResult.Succeeded;
        }

        try
        {
            return await _userManager.CheckPasswordAsync(user, password);
        }
        catch (Exception)
        {
            return false;
        }
    }

    private static bool IsLegacyPlainTextPasswordHash(string? passwordHash) =>
        !string.IsNullOrEmpty(passwordHash) && !passwordHash.StartsWith("AQAAAA", StringComparison.Ordinal);
}
