using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using WhithinMessenger.Application.Options;
using WhithinMessenger.Application.Services;
using WhithinMessenger.Domain.Models;

namespace WhithinMessenger.Infrastructure.Services;

public class EmailConfirmationService : IEmailConfirmationService
{
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly IEmailSender _emailSender;
    private readonly EmailSettings _settings;
    private readonly ILogger<EmailConfirmationService> _logger;

    public EmailConfirmationService(
        UserManager<ApplicationUser> userManager,
        IEmailSender emailSender,
        IOptions<EmailSettings> settings,
        ILogger<EmailConfirmationService> logger)
    {
        _userManager = userManager;
        _emailSender = emailSender;
        _settings = settings.Value;
        _logger = logger;
    }

    public async Task SendConfirmationEmailAsync(ApplicationUser user, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(user.Email))
        {
            throw new InvalidOperationException("User email is required for confirmation.");
        }

        var token = await _userManager.GenerateEmailConfirmationTokenAsync(user);
        var baseUrl = _settings.FrontendBaseUrl.TrimEnd('/');
        var link =
            $"{baseUrl}/confirm-email?userId={user.Id}&token={Uri.EscapeDataString(token)}";

        var html = $"""
            <div style="font-family:Segoe UI,Arial,sans-serif;line-height:1.5;color:#dcddde;background:#36393f;padding:24px;">
              <h2 style="color:#fff;margin:0 0 12px;">Подтвердите email в Whithin</h2>
              <p>Здравствуйте, <strong>{user.UserName}</strong>!</p>
              <p>Нажмите кнопку ниже, чтобы подтвердить адрес <strong>{user.Email}</strong>.</p>
              <p style="margin:24px 0;">
                <a href="{link}" style="background:#5865f2;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;display:inline-block;">
                  Подтвердить email
                </a>
              </p>
              <p style="font-size:13px;color:#949ba4;">Если кнопка не работает, скопируйте ссылку в браузер:</p>
              <p style="font-size:13px;word-break:break-all;"><a href="{link}" style="color:#66b3ff;">{link}</a></p>
            </div>
            """;

        try
        {
            await _emailSender.SendAsync(
                user.Email,
                "Подтвердите email — Whithin",
                html,
                cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to send confirmation email to {Email}", user.Email);
            throw;
        }
    }
}
