using FluentValidation;
using WhithinMessenger.Application.CommandsAndQueries.Auth.ResetPassword;

namespace WhithinMessenger.Application.Validators;

public class ResetPasswordCommandValidator : AbstractValidator<ResetPasswordCommand>
{
    public ResetPasswordCommandValidator()
    {
        RuleFor(x => x.UserId)
            .NotEmpty()
            .WithMessage("User id is required");

        RuleFor(x => x.Token)
            .NotEmpty()
            .WithMessage("Токен сброса обязателен");

        RuleFor(x => x.NewPassword)
            .NotEmpty()
            .WithMessage("Новый пароль обязателен")
            .MinimumLength(6)
            .WithMessage("Пароль должен содержать минимум 6 символов")
            .MaximumLength(100)
            .WithMessage("Пароль не может превышать 100 символов");
    }
}
