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

    public async Task SendEmailChangeConfirmationAsync(
        ApplicationUser user,
        string newEmail,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(newEmail))
        {
            throw new InvalidOperationException("New email is required.");
        }

        var token = await _userManager.GenerateChangeEmailTokenAsync(user, newEmail);
        var baseUrl = _settings.FrontendBaseUrl.TrimEnd('/');
        var link =
            $"{baseUrl}/confirm-email-change?userId={user.Id}&email={Uri.EscapeDataString(newEmail)}&token={Uri.EscapeDataString(token)}";

        var html = $"""
            <div style="font-family:Segoe UI,Arial,sans-serif;line-height:1.5;color:#dcddde;background:#36393f;padding:24px;">
              <h2 style="color:#fff;margin:0 0 12px;">Подтвердите смену email в Whithin</h2>
              <p>Здравствуйте, <strong>{user.UserName}</strong>!</p>
              <p>Вы запросили смену email на <strong>{newEmail}</strong>.</p>
              <p>Нажмите кнопку ниже, чтобы подтвердить новый адрес.</p>
              <p style="margin:24px 0;">
                <a href="{link}" style="background:#5865f2;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;display:inline-block;">
                  Подтвердить новый email
                </a>
              </p>
              <p style="font-size:13px;color:#949ba4;">Если вы не запрашивали смену email, проигнорируйте это письмо.</p>
              <p style="font-size:13px;word-break:break-all;"><a href="{link}" style="color:#66b3ff;">{link}</a></p>
            </div>
            """;

        try
        {
            await _emailSender.SendAsync(
                newEmail,
                "Подтвердите смену email — Whithin",
                html,
                cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to send email change confirmation to {Email}", newEmail);
            throw;
        }
    }

    public async Task SendPasswordChangeConfirmationAsync(
        ApplicationUser user,
        string confirmationToken,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(user.Email))
        {
            throw new InvalidOperationException("User email is required for password change confirmation.");
        }

        var baseUrl = _settings.FrontendBaseUrl.TrimEnd('/');
        var link =
            $"{baseUrl}/confirm-password-change?userId={user.Id}&token={Uri.EscapeDataString(confirmationToken)}";

        var html = $"""
            <div style="font-family:Segoe UI,Arial,sans-serif;line-height:1.5;color:#dcddde;background:#36393f;padding:24px;">
              <h2 style="color:#fff;margin:0 0 12px;">Подтвердите смену пароля в Whithin</h2>
              <p>Здравствуйте, <strong>{user.UserName}</strong>!</p>
              <p>Вы запросили смену пароля для аккаунта <strong>{user.Email}</strong>.</p>
              <p>Нажмите кнопку ниже, чтобы подтвердить новый пароль.</p>
              <p style="margin:24px 0;">
                <a href="{link}" style="background:#5865f2;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;display:inline-block;">
                  Подтвердить смену пароля
                </a>
              </p>
              <p style="font-size:13px;color:#949ba4;">Если вы не запрашивали смену пароля, проигнорируйте это письмо.</p>
              <p style="font-size:13px;word-break:break-all;"><a href="{link}" style="color:#66b3ff;">{link}</a></p>
            </div>
            """;

        try
        {
            await _emailSender.SendAsync(
                user.Email,
                "Подтвердите смену пароля — Whithin",
                html,
                cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to send password change confirmation to {Email}", user.Email);
            throw;
        }
    }
}
