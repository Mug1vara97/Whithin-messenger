using MediatR;
using Microsoft.AspNetCore.Identity;
using WhithinMessenger.Domain.Interfaces;
using WhithinMessenger.Domain.Models;

namespace WhithinMessenger.Application.CommandsAndQueries.Auth.ResetPassword;

public class ResetPasswordCommandHandler : IRequestHandler<ResetPasswordCommand, ResetPasswordResult>
{
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly IPasswordHasher<ApplicationUser> _passwordHasher;
    private readonly IUserRepository _userRepository;
    private readonly IPendingPasswordResetRepository _pendingPasswordResetRepository;

    public ResetPasswordCommandHandler(
        UserManager<ApplicationUser> userManager,
        IPasswordHasher<ApplicationUser> passwordHasher,
        IUserRepository userRepository,
        IPendingPasswordResetRepository pendingPasswordResetRepository)
    {
        _userManager = userManager;
        _passwordHasher = passwordHasher;
        _userRepository = userRepository;
        _pendingPasswordResetRepository = pendingPasswordResetRepository;
    }

    public async Task<ResetPasswordResult> Handle(
        ResetPasswordCommand request,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Token))
        {
            return new ResetPasswordResult(false, "Токен сброса обязателен");
        }

        if (string.IsNullOrWhiteSpace(request.NewPassword) || request.NewPassword.Length < 6)
        {
            return new ResetPasswordResult(false, "Пароль должен содержать минимум 6 символов");
        }

        var user = await _userManager.FindByIdAsync(request.UserId.ToString());
        if (user == null)
        {
            return new ResetPasswordResult(false, "Пользователь не найден");
        }

        var token = request.Token.Trim();
        var pendingReset = await _pendingPasswordResetRepository.GetByUserIdAndTokenAsync(
            request.UserId,
            token,
            cancellationToken);

        if (pendingReset == null)
        {
            return new ResetPasswordResult(false, "Неверная или просроченная ссылка сброса пароля");
        }

        if (pendingReset.ExpiresAt <= DateTimeOffset.UtcNow)
        {
            await _pendingPasswordResetRepository.DeleteAsync(pendingReset, cancellationToken);
            return new ResetPasswordResult(false, "Ссылка сброса пароля истекла");
        }

        var passwordHash = _passwordHasher.HashPassword(user, request.NewPassword);
        var securityStamp = Guid.NewGuid().ToString();
        var updated = await _userRepository.UpdatePasswordHashAsync(
            user.Id,
            passwordHash,
            securityStamp,
            cancellationToken);

        if (!updated)
        {
            return new ResetPasswordResult(false, "Не удалось обновить пароль");
        }

        await _pendingPasswordResetRepository.DeleteAsync(pendingReset, cancellationToken);

        return new ResetPasswordResult(true);
    }
}
