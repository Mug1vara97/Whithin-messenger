using MediatR;
using Microsoft.AspNetCore.Identity;
using WhithinMessenger.Domain.Models;

namespace WhithinMessenger.Application.CommandsAndQueries.Auth.ConfirmEmail;

public class ConfirmEmailCommandHandler : IRequestHandler<ConfirmEmailCommand, ConfirmEmailResult>
{
    private readonly UserManager<ApplicationUser> _userManager;

    public ConfirmEmailCommandHandler(UserManager<ApplicationUser> userManager)
    {
        _userManager = userManager;
    }

    public async Task<ConfirmEmailResult> Handle(ConfirmEmailCommand request, CancellationToken cancellationToken)
    {
        var user = await _userManager.FindByIdAsync(request.UserId.ToString());
        if (user == null)
        {
            return new ConfirmEmailResult(false, "Пользователь не найден");
        }

        if (user.EmailConfirmed)
        {
            return new ConfirmEmailResult(true);
        }

        var result = await _userManager.ConfirmEmailAsync(user, request.Token);
        if (result.Succeeded)
        {
            return new ConfirmEmailResult(true);
        }

        return new ConfirmEmailResult(false, "Неверная или просроченная ссылка подтверждения");
    }
}
