using System.Security.Cryptography;
using MediatR;
using Microsoft.AspNetCore.Identity;
using WhithinMessenger.Application.Services;
using WhithinMessenger.Domain.Interfaces;
using WhithinMessenger.Domain.Models;

namespace WhithinMessenger.Application.CommandsAndQueries.Auth.ForgotPassword;

public class ForgotPasswordCommandHandler : IRequestHandler<ForgotPasswordCommand, ForgotPasswordResult>
{
    private static readonly TimeSpan ResetLifetime = TimeSpan.FromHours(24);

    private readonly UserManager<ApplicationUser> _userManager;
    private readonly IPendingPasswordResetRepository _pendingPasswordResetRepository;
    private readonly IEmailConfirmationService _emailConfirmationService;

    public ForgotPasswordCommandHandler(
        UserManager<ApplicationUser> userManager,
        IPendingPasswordResetRepository pendingPasswordResetRepository,
        IEmailConfirmationService emailConfirmationService)
    {
        _userManager = userManager;
        _pendingPasswordResetRepository = pendingPasswordResetRepository;
        _emailConfirmationService = emailConfirmationService;
    }

    public async Task<ForgotPasswordResult> Handle(
        ForgotPasswordCommand request,
        CancellationToken cancellationToken)
    {
        var email = request.Email.Trim();
        var user = await _userManager.FindByEmailAsync(email);

        if (user == null || string.IsNullOrWhiteSpace(user.Email))
        {
            return new ForgotPasswordResult(true);
        }

        var token = GenerateResetToken();
        var pendingReset = new PendingPasswordReset
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            Token = token,
            CreatedAt = DateTimeOffset.UtcNow,
            ExpiresAt = DateTimeOffset.UtcNow.Add(ResetLifetime),
        };

        try
        {
            await _pendingPasswordResetRepository.ReplaceAsync(pendingReset, cancellationToken);
            await _emailConfirmationService.SendPasswordResetEmailAsync(user, token, cancellationToken);
        }
        catch
        {
            return new ForgotPasswordResult(false, "Не удалось отправить письмо. Попробуйте позже.");
        }

        return new ForgotPasswordResult(true);
    }

    private static string GenerateResetToken() =>
        Convert.ToBase64String(RandomNumberGenerator.GetBytes(32))
            .Replace('+', '-')
            .Replace('/', '_')
            .TrimEnd('=');
}
