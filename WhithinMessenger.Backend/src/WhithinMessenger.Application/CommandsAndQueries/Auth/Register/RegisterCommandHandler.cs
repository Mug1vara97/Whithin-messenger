using MediatR;
using Microsoft.AspNetCore.Identity;
using WhithinMessenger.Application.Services;
using WhithinMessenger.Domain.Interfaces;
using WhithinMessenger.Domain.Models;
using WhithinMessenger.Domain.Utils;

namespace WhithinMessenger.Application.CommandsAndQueries.Auth.Register;

public class RegisterCommandHandler : IRequestHandler<RegisterCommand, RegisterResult>
{
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly IUserProfileRepository _userProfileRepository;
    private readonly IEmailConfirmationService _emailConfirmationService;

    public RegisterCommandHandler(
        UserManager<ApplicationUser> userManager,
        IUserProfileRepository userProfileRepository,
        IEmailConfirmationService emailConfirmationService)
    {
        _userManager = userManager;
        _userProfileRepository = userProfileRepository;
        _emailConfirmationService = emailConfirmationService;
    }

    public async Task<RegisterResult> Handle(RegisterCommand request, CancellationToken cancellationToken)
    {
        var existingUser = await _userManager.FindByNameAsync(request.Username);
        if (existingUser != null)
        {
            return new RegisterResult(false, ErrorMessage: "Пользователь с таким именем уже существует");
        }

        var existingEmail = await _userManager.FindByEmailAsync(request.Email);
        if (existingEmail != null)
        {
            return new RegisterResult(false, ErrorMessage: "Пользователь с таким email уже существует");
        }

        var user = new ApplicationUser
        {
            UserName = request.Username,
            Email = request.Email,
            CreatedAt = DateTimeOffset.UtcNow,
            EmailConfirmed = false,
        };

        var result = await _userManager.CreateAsync(user, request.Password);

        if (!result.Succeeded)
        {
            var errors = string.Join(", ", result.Errors.Select(e => e.Description));
            return new RegisterResult(false, ErrorMessage: errors);
        }

        var userProfile = new UserProfile
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            AvatarColor = AvatarColorGenerator.GenerateColor(user.Id),
            Description = null,
            Avatar = null,
            Banner = null,
        };

        await _userProfileRepository.CreateAsync(userProfile, cancellationToken);

        try
        {
            await _emailConfirmationService.SendConfirmationEmailAsync(user, cancellationToken);
        }
        catch
        {
            await _userManager.DeleteAsync(user);
            return new RegisterResult(false, ErrorMessage: "Не удалось отправить письмо подтверждения. Попробуйте позже.");
        }

        return new RegisterResult(
            true,
            UserId: user.Id.ToString(),
            RequiresEmailConfirmation: true,
            Email: user.Email);
    }
}
