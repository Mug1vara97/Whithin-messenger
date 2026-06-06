using MediatR;
using Microsoft.AspNetCore.Identity;
using WhithinMessenger.Application.Services;
using WhithinMessenger.Domain.Models;

namespace WhithinMessenger.Application.CommandsAndQueries.Auth.ResendEmailConfirmation;

public class ResendEmailConfirmationCommandHandler
    : IRequestHandler<ResendEmailConfirmationCommand, ResendEmailConfirmationResult>
{
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly IEmailConfirmationService _emailConfirmationService;

    public ResendEmailConfirmationCommandHandler(
        UserManager<ApplicationUser> userManager,
        IEmailConfirmationService emailConfirmationService)
    {
        _userManager = userManager;
        _emailConfirmationService = emailConfirmationService;
    }

    public async Task<ResendEmailConfirmationResult> Handle(
        ResendEmailConfirmationCommand request,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Email))
        {
            return new ResendEmailConfirmationResult(false, "Email обязателен");
        }

        var user = await _userManager.FindByEmailAsync(request.Email.Trim());
        if (user == null || user.EmailConfirmed)
        {
            // Do not reveal whether the account exists.
            return new ResendEmailConfirmationResult(true);
        }

        try
        {
            await _emailConfirmationService.SendConfirmationEmailAsync(user, cancellationToken);
            return new ResendEmailConfirmationResult(true);
        }
        catch
        {
            return new ResendEmailConfirmationResult(false, "Не удалось отправить письмо. Попробуйте позже.");
        }
    }
}
