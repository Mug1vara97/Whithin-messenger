using MediatR;
using Microsoft.AspNetCore.Identity;
using WhithinMessenger.Domain.Interfaces;
using WhithinMessenger.Domain.Models;

namespace WhithinMessenger.Application.CommandsAndQueries.Auth.Login;

public class LoginCommandHandler : IRequestHandler<LoginCommand, LoginResult>
{
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly IPasswordHasher<ApplicationUser> _passwordHasher;
    private readonly IUserRepository _userRepository;

    public LoginCommandHandler(
        UserManager<ApplicationUser> userManager,
        IPasswordHasher<ApplicationUser> passwordHasher,
        IUserRepository userRepository)
    {
        _userManager = userManager;
        _passwordHasher = passwordHasher;
        _userRepository = userRepository;
    }

    public async Task<LoginResult> Handle(LoginCommand request, CancellationToken cancellationToken)
    {
        var user = await _userManager.FindByNameAsync(request.Username);

        if (user == null)
        {
            return new LoginResult(false, ErrorMessage: "Пользователь не найден");
        }

        if (!await IsPasswordValidAsync(user, request.Password, cancellationToken))
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

    private async Task<bool> IsPasswordValidAsync(
        ApplicationUser user,
        string password,
        CancellationToken cancellationToken)
    {
        if (IsLegacyPlainTextPasswordHash(user.PasswordHash))
        {
            if (user.PasswordHash != password)
            {
                return false;
            }

            var passwordHash = _passwordHasher.HashPassword(user, password);
            var securityStamp = Guid.NewGuid().ToString();
            var migrated = await _userRepository.UpdatePasswordHashAsync(
                user.Id,
                passwordHash,
                securityStamp,
                cancellationToken);

            if (migrated)
            {
                user.PasswordHash = passwordHash;
                user.SecurityStamp = securityStamp;
            }

            return migrated;
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
