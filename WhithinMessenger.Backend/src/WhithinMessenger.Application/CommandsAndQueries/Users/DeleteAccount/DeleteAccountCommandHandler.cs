using MediatR;
using Microsoft.AspNetCore.Identity;
using WhithinMessenger.Application.Services;
using WhithinMessenger.Domain.Models;

namespace WhithinMessenger.Application.CommandsAndQueries.Users.DeleteAccount;

public class DeleteAccountCommandHandler : IRequestHandler<DeleteAccountCommand, DeleteAccountResult>
{
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly IAccountDeletionService _accountDeletionService;

    public DeleteAccountCommandHandler(
        UserManager<ApplicationUser> userManager,
        IAccountDeletionService accountDeletionService)
    {
        _userManager = userManager;
        _accountDeletionService = accountDeletionService;
    }

    public async Task<DeleteAccountResult> Handle(DeleteAccountCommand request, CancellationToken cancellationToken)
    {
        var user = await _userManager.FindByIdAsync(request.UserId.ToString());
        if (user == null)
        {
            return new DeleteAccountResult(false, "Пользователь не найден");
        }

        if (!await VerifyCurrentPasswordAsync(user, request.Password))
        {
            return new DeleteAccountResult(false, "Неверный пароль");
        }

        var deletionResult = await _accountDeletionService.DeleteAccountAsync(user.Id, cancellationToken);
        return new DeleteAccountResult(deletionResult.Success, deletionResult.ErrorMessage);
    }

    private async Task<bool> VerifyCurrentPasswordAsync(ApplicationUser user, string password)
    {
        if (IsLegacyPlainTextPasswordHash(user.PasswordHash))
        {
            return user.PasswordHash == password;
        }

        try
        {
            return await _userManager.CheckPasswordAsync(user, password);
        }
        catch
        {
            return false;
        }
    }

    private static bool IsLegacyPlainTextPasswordHash(string? passwordHash) =>
        !string.IsNullOrEmpty(passwordHash) && !passwordHash.StartsWith("AQAAAA", StringComparison.Ordinal);
}
