using MediatR;
using Microsoft.AspNetCore.Identity;
using WhithinMessenger.Domain.Models;

namespace WhithinMessenger.Application.CommandsAndQueries.Auth.ConfirmEmailChange;

public class ConfirmEmailChangeCommandHandler : IRequestHandler<ConfirmEmailChangeCommand, ConfirmEmailChangeResult>
{
    private readonly UserManager<ApplicationUser> _userManager;

    public ConfirmEmailChangeCommandHandler(UserManager<ApplicationUser> userManager)
    {
        _userManager = userManager;
    }

    public async Task<ConfirmEmailChangeResult> Handle(
        ConfirmEmailChangeCommand request,
        CancellationToken cancellationToken)
    {
        var user = await _userManager.FindByIdAsync(request.UserId.ToString());
        if (user == null)
        {
            return new ConfirmEmailChangeResult(false, "Пользователь не найден");
        }

        var newEmail = request.NewEmail.Trim();
        var result = await _userManager.ChangeEmailAsync(user, newEmail, request.Token);
        if (!result.Succeeded)
        {
            return new ConfirmEmailChangeResult(false, "Неверная или просроченная ссылка подтверждения");
        }

        return new ConfirmEmailChangeResult(true, Email: user.Email);
    }
}
