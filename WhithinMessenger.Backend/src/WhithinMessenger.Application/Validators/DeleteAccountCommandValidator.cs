using FluentValidation;
using WhithinMessenger.Application.CommandsAndQueries.Users.DeleteAccount;

namespace WhithinMessenger.Application.Validators;

public class DeleteAccountCommandValidator : AbstractValidator<DeleteAccountCommand>
{
    public DeleteAccountCommandValidator()
    {
        RuleFor(x => x.UserId).NotEmpty();
        RuleFor(x => x.Password).NotEmpty().WithMessage("Пароль обязателен");
    }
}
