namespace WhithinMessenger.Application.Services;

public interface IAccountDeletionService
{
    Task<AccountDeletionResult> DeleteAccountAsync(Guid userId, CancellationToken cancellationToken = default);
}

public record AccountDeletionResult(bool Success, string? ErrorMessage);
