using FluentValidation;
using WhithinMessenger.Application.CommandsAndQueries.Auth.ChangeEmail;

namespace WhithinMessenger.Application.Validators;

public class ChangeEmailCommandValidator : AbstractValidator<ChangeEmailCommand>
{
    public ChangeEmailCommandValidator()
    {
        RuleFor(x => x.UserId)
            .NotEmpty()
            .WithMessage("User id is required");

        RuleFor(x => x.NewEmail)
            .NotEmpty()
            .WithMessage("Email is required")
            .EmailAddress()
            .WithMessage("Email must be a valid email address")
            .MaximumLength(100)
            .WithMessage("Email cannot exceed 100 characters");

        RuleFor(x => x.CurrentPassword)
            .NotEmpty()
            .WithMessage("Password is required");
    }
}
