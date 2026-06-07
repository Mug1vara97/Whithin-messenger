using FluentValidation;
using WhithinMessenger.Application.CommandsAndQueries.Auth.ForgotPassword;

namespace WhithinMessenger.Application.Validators;

public class ForgotPasswordCommandValidator : AbstractValidator<ForgotPasswordCommand>
{
    public ForgotPasswordCommandValidator()
    {
        RuleFor(x => x.Email)
            .NotEmpty()
            .WithMessage("Email обязателен")
            .EmailAddress()
            .WithMessage("Некорректный email");
    }
}
