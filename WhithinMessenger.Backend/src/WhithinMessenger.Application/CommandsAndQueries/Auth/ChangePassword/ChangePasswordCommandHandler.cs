using System.Security.Cryptography;
using MediatR;
using Microsoft.AspNetCore.Identity;
using WhithinMessenger.Application.Services;
using WhithinMessenger.Domain.Interfaces;
using WhithinMessenger.Domain.Models;

namespace WhithinMessenger.Application.CommandsAndQueries.Auth.ChangePassword;

public class ChangePasswordCommandHandler : IRequestHandler<ChangePasswordCommand, ChangePasswordResult>
{
    private static readonly TimeSpan ConfirmationLifetime = TimeSpan.FromHours(24);

    private readonly UserManager<ApplicationUser> _userManager;
    private readonly IPasswordHasher<ApplicationUser> _passwordHasher;
    private readonly IPendingPasswordChangeRepository _pendingPasswordChangeRepository;
    private readonly IEmailConfirmationService _emailConfirmationService;

    public ChangePasswordCommandHandler(
        UserManager<ApplicationUser> userManager,
        IPasswordHasher<ApplicationUser> passwordHasher,
        IPendingPasswordChangeRepository pendingPasswordChangeRepository,
        IEmailConfirmationService emailConfirmationService)
    {
        _userManager = userManager;
        _passwordHasher = passwordHasher;
        _pendingPasswordChangeRepository = pendingPasswordChangeRepository;
        _emailConfirmationService = emailConfirmationService;
    }

    public async Task<ChangePasswordResult> Handle(
        ChangePasswordCommand request,
        CancellationToken cancellationToken)
    {
        var user = await _userManager.FindByIdAsync(request.UserId.ToString());
        if (user == null)
        {
            return new ChangePasswordResult(false, "Пользователь не найден");
        }

        if (string.IsNullOrWhiteSpace(user.Email))
        {
            return new ChangePasswordResult(false, "Для смены пароля необходим подтверждённый email");
        }

        if (!await VerifyCurrentPasswordAsync(user, request.CurrentPassword))
        {
            return new ChangePasswordResult(false, "Неверный текущий пароль");
        }

        if (request.CurrentPassword == request.NewPassword)
        {
            return new ChangePasswordResult(false, "Новый пароль должен отличаться от текущего");
        }

        var token = GenerateConfirmationToken();
        var pendingChange = new PendingPasswordChange
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            PasswordHash = _passwordHasher.HashPassword(user, request.NewPassword),
            Token = token,
            CreatedAt = DateTimeOffset.UtcNow,
            ExpiresAt = DateTimeOffset.UtcNow.Add(ConfirmationLifetime),
        };

        try
        {
            await _pendingPasswordChangeRepository.ReplaceAsync(pendingChange, cancellationToken);
            await _emailConfirmationService.SendPasswordChangeConfirmationAsync(user, token, cancellationToken);
        }
        catch
        {
            return new ChangePasswordResult(false, "Не удалось отправить письмо подтверждения. Попробуйте позже.");
        }

        return new ChangePasswordResult(true, ConfirmationEmail: user.Email);
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

    private static string GenerateConfirmationToken() =>
        Convert.ToBase64String(RandomNumberGenerator.GetBytes(32))
            .Replace('+', '-')
            .Replace('/', '_')
            .TrimEnd('=');
}
