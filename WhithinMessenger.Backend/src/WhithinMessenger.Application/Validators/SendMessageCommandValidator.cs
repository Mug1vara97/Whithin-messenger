using FluentValidation;
using WhithinMessenger.Application.CommandsAndQueries.Messages.SendMessage;

namespace WhithinMessenger.Application.Validators;

public class SendMessageCommandValidator : AbstractValidator<SendMessageCommand>
{
    public SendMessageCommandValidator()
    {
        RuleFor(x => x.UserId)
            .NotEmpty()
            .WithMessage("User ID is required");

        RuleFor(x => x.ChatId)
            .NotEmpty()
            .WithMessage("Chat ID is required");

        RuleFor(x => x.Content)
            .NotEmpty()
            .WithMessage("Message content is required")
            .MaximumLength(4000)
            .WithMessage("Message content cannot exceed 4000 characters");
    }
}

