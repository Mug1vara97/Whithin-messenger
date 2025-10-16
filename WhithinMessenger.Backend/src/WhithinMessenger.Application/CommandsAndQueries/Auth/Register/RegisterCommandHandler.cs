using MediatR;
using Microsoft.AspNetCore.Identity;
using WhithinMessenger.Domain.Models;
using WhithinMessenger.Domain.Interfaces;
using WhithinMessenger.Domain.Utils;

namespace WhithinMessenger.Application.CommandsAndQueries.Auth.Register;

public class RegisterCommandHandler : IRequestHandler<RegisterCommand, RegisterResult>
{
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly IUserProfileRepository _userProfileRepository;

    public RegisterCommandHandler(UserManager<ApplicationUser> userManager, IUserProfileRepository userProfileRepository)
    {
        _userManager = userManager;
        _userProfileRepository = userProfileRepository;
    }

    public async Task<RegisterResult> Handle(RegisterCommand request, CancellationToken cancellationToken)
    {
        // Проверяем, существует ли пользователь
        var existingUser = await _userManager.FindByNameAsync(request.Username);
        if (existingUser != null)
        {
            return new RegisterResult(false, ErrorMessage: "Пользователь с таким именем уже существует");
        }

        // Создаем нового пользователя
        var user = new ApplicationUser
        {
            UserName = request.Username,
            Email = request.Email,
            PasswordHash = request.Password, // Сохраняем пароль без хеширования
            CreatedAt = DateTimeOffset.UtcNow
        };

        var result = await _userManager.CreateAsync(user);
        
        if (result.Succeeded)
        {
            // Создаем профиль пользователя с случайным цветом аватара
            var userProfile = new UserProfile
            {
                Id = Guid.NewGuid(),
                UserId = user.Id,
                AvatarColor = AvatarColorGenerator.GenerateColor(user.Id),
                Description = null,
                Avatar = null,
                Banner = null
            };

            await _userProfileRepository.CreateAsync(userProfile, cancellationToken);
            
            return new RegisterResult(true, UserId: user.Id.ToString());
        }

        var errors = string.Join(", ", result.Errors.Select(e => e.Description));
        return new RegisterResult(false, ErrorMessage: errors);
    }
}
















