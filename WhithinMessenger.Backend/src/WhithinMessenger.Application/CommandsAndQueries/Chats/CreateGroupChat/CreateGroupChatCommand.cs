using MediatR;

namespace WhithinMessenger.Application.CommandsAndQueries.Chats.CreateGroupChat;

public class CreateGroupChatCommand : IRequest<CreateGroupChatResult>
{
    public Guid CreatorId { get; set; }
    public string ChatName { get; set; } = string.Empty;
    public List<Guid> MemberIds { get; set; } = new();

    public CreateGroupChatCommand(Guid creatorId, string chatName, List<Guid> memberIds)
    {
        CreatorId = creatorId;
        ChatName = chatName;
        MemberIds = memberIds;
    }
}











