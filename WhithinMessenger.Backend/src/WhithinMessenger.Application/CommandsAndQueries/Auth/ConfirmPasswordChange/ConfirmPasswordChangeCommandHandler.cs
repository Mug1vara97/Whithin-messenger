using MediatR;
using Microsoft.AspNetCore.Identity;
using WhithinMessenger.Domain.Interfaces;
using WhithinMessenger.Domain.Models;

namespace WhithinMessenger.Application.CommandsAndQueries.Auth.ConfirmPasswordChange;

public class ConfirmPasswordChangeCommandHandler
    : IRequestHandler<ConfirmPasswordChangeCommand, ConfirmPasswordChangeResult>
{
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly IUserRepository _userRepository;
    private readonly IPendingPasswordChangeRepository _pendingPasswordChangeRepository;

    public ConfirmPasswordChangeCommandHandler(
        UserManager<ApplicationUser> userManager,
        IUserRepository userRepository,
        IPendingPasswordChangeRepository pendingPasswordChangeRepository)
    {
        _userManager = userManager;
        _userRepository = userRepository;
        _pendingPasswordChangeRepository = pendingPasswordChangeRepository;
    }

    public async Task<ConfirmPasswordChangeResult> Handle(
        ConfirmPasswordChangeCommand request,
        CancellationToken cancellationToken)
    {
        var user = await _userManager.FindByIdAsync(request.UserId.ToString());
        if (user == null)
        {
            return new ConfirmPasswordChangeResult(false, "Пользователь не найден");
        }

        var pendingChange = await _pendingPasswordChangeRepository.GetByUserIdAndTokenAsync(
            request.UserId,
            request.Token,
            cancellationToken);

        if (pendingChange == null)
        {
            return new ConfirmPasswordChangeResult(false, "Неверная или просроченная ссылка подтверждения");
        }

        if (pendingChange.ExpiresAt <= DateTimeOffset.UtcNow)
        {
            await _pendingPasswordChangeRepository.DeleteAsync(pendingChange, cancellationToken);
            return new ConfirmPasswordChangeResult(false, "Ссылка подтверждения истекла");
        }

        var securityStamp = Guid.NewGuid().ToString();
        var updated = await _userRepository.UpdatePasswordHashAsync(
            user.Id,
            pendingChange.PasswordHash,
            securityStamp,
            cancellationToken);

        if (!updated)
        {
            return new ConfirmPasswordChangeResult(false, "Не удалось обновить пароль");
        }

        await _pendingPasswordChangeRepository.DeleteAsync(pendingChange, cancellationToken);

        return new ConfirmPasswordChangeResult(true);
    }
}
