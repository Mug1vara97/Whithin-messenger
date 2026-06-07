using WhithinMessenger.Domain.Models;

namespace WhithinMessenger.Application.Services;

public interface IEmailConfirmationService
{
    Task SendConfirmationEmailAsync(ApplicationUser user, CancellationToken cancellationToken = default);
    Task SendEmailChangeConfirmationAsync(
        ApplicationUser user,
        string newEmail,
        CancellationToken cancellationToken = default);
    Task SendPasswordChangeConfirmationAsync(
        ApplicationUser user,
        string confirmationToken,
        CancellationToken cancellationToken = default);
    Task SendPasswordResetEmailAsync(
        ApplicationUser user,
        string resetToken,
        CancellationToken cancellationToken = default);
}
