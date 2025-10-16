using FluentValidation;
using WhithinMessenger.Application.CommandsAndQueries.Chats.UploadChatAvatar;

namespace WhithinMessenger.Application.Validators;

public class UploadChatAvatarCommandValidator : AbstractValidator<UploadChatAvatarCommand>
{
    public UploadChatAvatarCommandValidator()
    {
        RuleFor(x => x.ChatId)
            .NotEmpty()
            .WithMessage("Chat ID is required");

        RuleFor(x => x.UserId)
            .NotEmpty()
            .WithMessage("User ID is required");

        RuleFor(x => x.File)
            .NotNull()
            .WithMessage("File is required")
            .Must(file => file != null && file.Length > 0)
            .WithMessage("File cannot be empty")
            .Must(file => file != null && file.Length <= 5 * 1024 * 1024)
            .WithMessage("File size cannot exceed 5MB")
            .Must(file => file != null && IsValidImageType(file.ContentType))
            .WithMessage("File must be a valid image (JPEG, PNG, GIF, WebP)");
    }

    private static bool IsValidImageType(string contentType)
    {
        var allowedTypes = new[] { "image/jpeg", "image/png", "image/gif", "image/webp" };
        return allowedTypes.Contains(contentType);
    }
}

