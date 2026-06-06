using MediatR;
using Microsoft.AspNetCore.Identity;
using WhithinMessenger.Application.Services;
using WhithinMessenger.Domain.Models;

namespace WhithinMessenger.Application.CommandsAndQueries.Auth.ChangeEmail;

public class ChangeEmailCommandHandler : IRequestHandler<ChangeEmailCommand, ChangeEmailResult>
{
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly IEmailConfirmationService _emailConfirmationService;

    public ChangeEmailCommandHandler(
        UserManager<ApplicationUser> userManager,
        IEmailConfirmationService emailConfirmationService)
    {
        _userManager = userManager;
        _emailConfirmationService = emailConfirmationService;
    }

    public async Task<ChangeEmailResult> Handle(
        ChangeEmailCommand request,
        CancellationToken cancellationToken)
    {
        var user = await _userManager.FindByIdAsync(request.UserId.ToString());
        if (user == null)
        {
            return new ChangeEmailResult(false, "Пользователь не найден");
        }

        var normalizedNewEmail = _userManager.NormalizeEmail(request.NewEmail.Trim());
        if (string.Equals(user.NormalizedEmail, normalizedNewEmail, StringComparison.Ordinal))
        {
            return new ChangeEmailResult(false, "Новый email совпадает с текущим");
        }

        var existingUser = await _userManager.FindByEmailAsync(request.NewEmail.Trim());
        if (existingUser != null && existingUser.Id != user.Id)
        {
            return new ChangeEmailResult(false, "Этот email уже используется");
        }

        if (!await VerifyCurrentPasswordAsync(user, request.CurrentPassword))
        {
            return new ChangeEmailResult(false, "Неверный пароль");
        }

        try
        {
            await _emailConfirmationService.SendEmailChangeConfirmationAsync(
                user,
                request.NewEmail.Trim(),
                cancellationToken);
        }
        catch
        {
            return new ChangeEmailResult(false, "Не удалось отправить письмо подтверждения. Попробуйте позже.");
        }

        return new ChangeEmailResult(
            true,
            PendingEmail: request.NewEmail.Trim());
    }

    private async Task<bool> VerifyCurrentPasswordAsync(ApplicationUser user, string password)
    {
        if (IsLegacyPlainTextPasswordHash(user.PasswordHash))
        {
            return user.PasswordHash == password;
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
