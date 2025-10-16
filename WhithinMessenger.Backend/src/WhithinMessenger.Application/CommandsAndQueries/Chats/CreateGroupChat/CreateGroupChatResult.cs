namespace WhithinMessenger.Application.CommandsAndQueries.Chats.CreateGroupChat;

public class CreateGroupChatResult
{
    public bool Success { get; set; }
    public string? ErrorMessage { get; set; }
    public Guid? ChatId { get; set; }

    public CreateGroupChatResult(bool success, string? errorMessage = null, Guid? chatId = null)
    {
        Success = success;
        ErrorMessage = errorMessage;
        ChatId = chatId;
    }

    public static CreateGroupChatResult SuccessResult(Guid chatId)
    {
        return new CreateGroupChatResult(true, null, chatId);
    }

    public static CreateGroupChatResult FailureResult(string errorMessage)
    {
        return new CreateGroupChatResult(false, errorMessage);
    }
}
