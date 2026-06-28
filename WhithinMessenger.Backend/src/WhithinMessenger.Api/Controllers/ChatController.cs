using MediatR;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using WhithinMessenger.Api.Attributes;
using WhithinMessenger.Api.Hubs;
using WhithinMessenger.Application.CommandsAndQueries.Chats.GetUserChats;
using WhithinMessenger.Application.CommandsAndQueries.Chats.CreatePrivateChat;
using WhithinMessenger.Application.CommandsAndQueries.Chats.GetChatParticipants;
using WhithinMessenger.Application.CommandsAndQueries.Chats.GetAvailableUsers;
using WhithinMessenger.Application.CommandsAndQueries.Chats.AddUserToGroup;
using WhithinMessenger.Application.CommandsAndQueries.Chats.GetChatInfo;
using WhithinMessenger.Application.CommandsAndQueries.Chats.UpdateChatAvatar;
using WhithinMessenger.Application.CommandsAndQueries.Chats.UploadChatAvatar;
using WhithinMessenger.Application.CommandsAndQueries.Messages.SendMessage;
using WhithinMessenger.Application.CommandsAndQueries.Messages.GetMessages;
using WhithinMessenger.Application.CommandsAndQueries.Messages.EditMessage;
using WhithinMessenger.Application.CommandsAndQueries.Messages.DeleteMessage;

namespace WhithinMessenger.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [RequireAuth]
    public class ChatController : ControllerBase
    {
        private readonly IMediator _mediator;
        private readonly IHubContext<GroupChatHub> _groupChatHub;

        public ChatController(IMediator mediator, IHubContext<GroupChatHub> groupChatHub)
        {
            _mediator = mediator;
            _groupChatHub = groupChatHub;
        }

        [HttpGet("user-chats")]
        public async Task<IActionResult> GetUserChats()
        {
            try
            {
                var userId = (Guid)HttpContext.Items["UserId"]!;
                var query = new GetUserChatsQuery(userId);
                var result = await _mediator.Send(query);
                
                return Ok(result.Chats);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = "Произошла ошибка при получении списка чатов: " + ex.Message });
            }
        }

        [HttpPost("create-private")]
        public async Task<IActionResult> CreatePrivateChat([FromBody] CreatePrivateChatRequest request)
        {
            try
            {
                var userId = (Guid)HttpContext.Items["UserId"]!;
                var command = new CreatePrivateChatCommand(userId, request.TargetUserId);
                var result = await _mediator.Send(command);

                if (!result.Success)
                {
                    return BadRequest(new { error = result.ErrorMessage });
                }

                return Ok(new { chatId = result.ChatId, exists = result.Exists });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = "Произошла ошибка при создании чата: " + ex.Message });
            }
        }

        [HttpGet("{chatId}/info")]
        public async Task<IActionResult> GetChatInfo(Guid chatId)
        {
            try
            {
                var userId = (Guid)HttpContext.Items["UserId"]!;
                var query = new GetChatInfoQuery(chatId, userId);
                var result = await _mediator.Send(query);

                if (!result.Success)
                {
                    return BadRequest(new { error = result.ErrorMessage });
                }

                return Ok(result.ChatInfo);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = "Произошла ошибка при получении информации о чате: " + ex.Message });
            }
        }

        [HttpPost("{chatId}/avatar")]
        public async Task<IActionResult> UploadChatAvatar(Guid chatId, IFormFile file)
        {
            try
            {
                var userId = (Guid)HttpContext.Items["UserId"]!;
                var command = new UploadChatAvatarCommand(chatId, userId, file);
                var result = await _mediator.Send(command);

                if (!result.Success)
                {
                    return BadRequest(new { error = result.ErrorMessage });
                }

                return Ok(new { avatarUrl = result.AvatarUrl });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = "Произошла ошибка при загрузке аватара чата: " + ex.Message });
            }
        }


        [HttpGet("{chatId}/messages")]
        public async Task<IActionResult> GetMessages(
            Guid chatId,
            [FromQuery] int limit = 0,
            [FromQuery] Guid? beforeMessageId = null)
        {
            try
            {
                var userId = (Guid)HttpContext.Items["UserId"]!;
                var query = new GetMessagesQuery(chatId, userId, limit, beforeMessageId);
                var result = await _mediator.Send(query);

                if (!result.Success)
                {
                    return BadRequest(new { error = result.ErrorMessage });
                }

                if (limit > 0 || beforeMessageId.HasValue)
                {
                    return Ok(new
                    {
                        messages = result.Messages,
                        hasMoreOlder = result.HasMoreOlder,
                    });
                }

                return Ok(result.Messages);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = "Произошла ошибка при получении сообщений: " + ex.Message });
            }
        }

        [HttpPost("{chatId}/messages")]
        public async Task<IActionResult> SendMessage(Guid chatId, [FromBody] SendMessageRequest request)
        {
            try
            {
                var userId = (Guid)HttpContext.Items["UserId"]!;
                var command = new SendMessageCommand(
                    userId,
                    chatId,
                    request.Content,
                    request.RepliedToMessageId,
                    request.ForwardedFromMessageId,
                    request.EncryptionVersion
                );
                var result = await _mediator.Send(command);

                if (!result.Success)
                {
                    return BadRequest(new { error = result.ErrorMessage });
                }

                return Ok(new { messageId = result.MessageId });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = "Произошла ошибка при отправке сообщения: " + ex.Message });
            }
        }

        [HttpPut("messages/{messageId}")]
        public async Task<IActionResult> EditMessage(Guid messageId, [FromBody] EditMessageRequest request)
        {
            try
            {
                var userId = (Guid)HttpContext.Items["UserId"]!;
                var command = new EditMessageCommand(messageId, userId, request.NewContent);
                var result = await _mediator.Send(command);

                if (!result.Success)
                {
                    return BadRequest(new { error = result.ErrorMessage });
                }

                return Ok(new { success = true });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = "Произошла ошибка при редактировании сообщения: " + ex.Message });
            }
        }

        [HttpDelete("messages/{messageId}")]
        public async Task<IActionResult> DeleteMessage(Guid messageId)
        {
            try
            {
                var userId = (Guid)HttpContext.Items["UserId"]!;
                var command = new DeleteMessageCommand(messageId, userId);
                var result = await _mediator.Send(command);

                if (!result.Success)
                {
                    return BadRequest(new { error = result.ErrorMessage });
                }

                if (result.ChatId.HasValue)
                {
                    await _groupChatHub.Clients
                        .Group(result.ChatId.Value.ToString())
                        .SendAsync("MessageDeleted", result.MessageId);
                }

                return Ok(new { success = true });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = "Произошла ошибка при удалении сообщения: " + ex.Message });
            }
        }

        [HttpGet("{chatId}/participants")]
        public async Task<IActionResult> GetChatParticipants(Guid chatId)
        {
            try
            {
                var userId = (Guid)HttpContext.Items["UserId"]!;
                Console.WriteLine($"ChatController - GetChatParticipants called for chatId: {chatId}, userId: {userId}");
                
                var query = new GetChatParticipantsQuery(chatId, userId);
                var result = await _mediator.Send(query);

                Console.WriteLine($"ChatController - Query result: Success={result.Success}, ParticipantsCount={result.Participants?.Count ?? 0}");

                if (!result.Success)
                {
                    Console.WriteLine($"ChatController - Query failed: {result.ErrorMessage}");
                    return BadRequest(new { error = result.ErrorMessage });
                }

                Console.WriteLine($"ChatController - Returning {result.Participants.Count} participants");
                return Ok(result.Participants);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"ChatController - Exception: {ex.Message}");
                Console.WriteLine($"ChatController - Stack trace: {ex.StackTrace}");
                return StatusCode(500, new { error = "Произошла ошибка при получении участников чата: " + ex.Message });
            }
        }

    [HttpGet("{chatId}/available-users")]
    public async Task<IActionResult> GetAvailableUsers(Guid chatId)
    {
        try
        {
            var userId = (Guid)HttpContext.Items["UserId"]!;
            Console.WriteLine($"🔍 ChatController - GetAvailableUsers called for chatId: {chatId}, userId: {userId}");
            
            var query = new GetAvailableUsersQuery(chatId, userId);
            var result = await _mediator.Send(query);

            Console.WriteLine($"🔍 ChatController - Query result: Success={result.Success}, AvailableUsersCount={result.AvailableUsers?.Count ?? 0}");

            if (!result.Success)
            {
                Console.WriteLine($"ChatController - Query failed: {result.ErrorMessage}");
                return BadRequest(new { error = result.ErrorMessage });
            }

            Console.WriteLine($"ChatController - Returning {result.AvailableUsers.Count} available users");
            return Ok(result.AvailableUsers);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"ChatController - Exception: {ex.Message}");
            return StatusCode(500, new { error = "Произошла ошибка при получении доступных пользователей: " + ex.Message });
        }
    }

    [HttpPost("{chatId}/add-user")]
    public async Task<IActionResult> AddUserToGroup(Guid chatId, [FromBody] AddUserToGroupRequest request)
    {
        try
        {
            var userId = (Guid)HttpContext.Items["UserId"]!;
            Console.WriteLine($"ChatController - AddUserToGroup called for chatId: {chatId}, targetUserId: {request.UserId}, currentUserId: {userId}");
            
            var command = new AddUserToGroupCommand(chatId, request.UserId, userId);
            var result = await _mediator.Send(command);

            Console.WriteLine($"ChatController - Command result: Success={result.Success}");

            if (!result.Success)
            {
                Console.WriteLine($"ChatController - Command failed: {result.ErrorMessage}");
                return BadRequest(new { error = result.ErrorMessage });
            }

            Console.WriteLine($"ChatController - User {request.UserId} added to group {chatId}");
            return Ok(new { message = "Пользователь успешно добавлен в группу" });
        }
        catch (Exception ex)
        {
            Console.WriteLine($"ChatController - Exception: {ex.Message}");
            return StatusCode(500, new { error = "Произошла ошибка при добавлении пользователя в группу: " + ex.Message });
        }
    }

}

public class CreatePrivateChatRequest
{
    public Guid TargetUserId { get; set; }
}

public class SendMessageRequest
{
    public string Content { get; set; } = string.Empty;
    public Guid? RepliedToMessageId { get; set; }
    public Guid? ForwardedFromMessageId { get; set; }
    public int EncryptionVersion { get; set; }
}

public class EditMessageRequest
{
    public string NewContent { get; set; } = string.Empty;
}

public class AddUserToGroupRequest
{
    public Guid UserId { get; set; }
}
}




