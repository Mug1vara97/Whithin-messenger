using FluentValidation;
using WhithinMessenger.Application.CommandsAndQueries.Auth.ChangePassword;

namespace WhithinMessenger.Application.Validators;

public class ChangePasswordCommandValidator : AbstractValidator<ChangePasswordCommand>
{
    public ChangePasswordCommandValidator()
    {
        RuleFor(x => x.UserId)
            .NotEmpty()
            .WithMessage("User id is required");

        RuleFor(x => x.CurrentPassword)
            .NotEmpty()
            .WithMessage("Current password is required");

        RuleFor(x => x.NewPassword)
            .NotEmpty()
            .WithMessage("New password is required")
            .MinimumLength(6)
            .WithMessage("Password must be at least 6 characters")
            .MaximumLength(100)
            .WithMessage("Password cannot exceed 100 characters");
    }
}
