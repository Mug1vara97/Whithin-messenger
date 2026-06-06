using WhithinMessenger.Domain.Models;

namespace WhithinMessenger.Application.Services;

public interface IEmailConfirmationService
{
    Task SendConfirmationEmailAsync(ApplicationUser user, CancellationToken cancellationToken = default);
}
