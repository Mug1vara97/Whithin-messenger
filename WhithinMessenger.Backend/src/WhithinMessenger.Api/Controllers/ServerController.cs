using MediatR;
using Microsoft.AspNetCore.Mvc;
using WhithinMessenger.Api.Attributes;
using WhithinMessenger.Application.CommandsAndQueries.Servers;
using WhithinMessenger.Application.CommandsAndQueries.Servers.AddMember;
using WhithinMessenger.Domain.Interfaces;

namespace WhithinMessenger.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[RequireAuth]
public class ServerController : ControllerBase
{
    private readonly IServerRepository _serverRepository;
    private readonly IMediator _mediator;

    public ServerController(IServerRepository serverRepository, IMediator mediator)
    {
        _serverRepository = serverRepository;
        _mediator = mediator;
    }

    [HttpGet("servers")]
    public async Task<IActionResult> GetUserServers()
    {
        try
        {
            var userId = (Guid)HttpContext.Items["UserId"]!;
            
            var servers = await _serverRepository.GetUserServersAsync(userId);
            
            var serverDtos = servers.Select(s => new
            {
                serverId = s.Id,
                name = s.Name,
                ownerId = s.OwnerId,
                createdAt = s.CreatedAt,
                isPublic = s.IsPublic,
                description = s.Description,
                avatar = s.Avatar,
                banner = s.Banner,
                bannerColor = s.BannerColor
            }).ToList();
            
            return Ok(serverDtos);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = "Произошла ошибка при получении списка серверов: " + ex.Message });
        }
    }

    [HttpGet("{serverId}")]
    public async Task<IActionResult> GetServerById(Guid serverId)
    {
        try
        {
            var userId = (Guid)HttpContext.Items["UserId"]!;
            
            var query = new GetServerQuery(serverId, userId);
            var result = await _mediator.Send(query);

            if (!result.Success)
            {
                if (result.ErrorMessage == "Сервер не найден")
                {
                    return NotFound(new { error = result.ErrorMessage });
                }
                if (result.ErrorMessage == "У вас нет доступа к этому серверу")
                {
                    return Forbid(result.ErrorMessage);
                }
                return StatusCode(500, new { error = result.ErrorMessage });
            }
            
            return Ok(result.Server);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = "Произошла ошибка при получении сервера: " + ex.Message });
        }
    }

    [HttpGet("{serverId}/banner")]
    public async Task<IActionResult> GetServerBanner(Guid serverId)
    {
        try
        {
            var userId = (Guid)HttpContext.Items["UserId"]!;
            
            var server = await _serverRepository.GetByIdAsync(serverId);
            if (server == null)
            {
                return NotFound(new { error = "Сервер не найден" });
            }

            var userServers = await _serverRepository.GetUserServersAsync(userId);
            if (!userServers.Any(s => s.Id == serverId))
            {
                return Forbid("У вас нет доступа к этому серверу");
            }

            if (string.IsNullOrEmpty(server.Banner))
            {
                return NotFound(new { error = "Баннер не найден" });
            }
            
            return Ok(new { banner = server.Banner });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = "Произошла ошибка при получении баннера: " + ex.Message });
        }
    }

    [HttpGet("public")]
    public async Task<IActionResult> GetPublicServers()
    {
        try
        {
            var query = new GetPublicServersQuery();
            var result = await _mediator.Send(query);

            if (!result.Success)
            {
                return StatusCode(500, new { error = result.ErrorMessage });
            }
            
            return Ok(result.Servers);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = "Произошла ошибка при получении публичных серверов: " + ex.Message });
        }
    }

    [HttpPost("{serverId}/join")]
    public async Task<IActionResult> JoinServer(Guid serverId)
    {
        try
        {
            var userId = (Guid)HttpContext.Items["UserId"]!;
            
            var command = new JoinServerCommand(serverId, userId);
            var result = await _mediator.Send(command);

            if (!result.Success)
            {
                return BadRequest(new { error = result.ErrorMessage });
            }
            
            return Ok(new { message = "Успешно присоединились к серверу" });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = "Произошла ошибка при присоединении к серверу: " + ex.Message });
        }
    }

    [HttpPost("{serverId}/banner")]
    public async Task<IActionResult> UploadServerBanner(Guid serverId, IFormFile file)
    {
        try
        {
            var userId = (Guid)HttpContext.Items["UserId"]!;
            
            var server = await _serverRepository.GetByIdAsync(serverId);
            if (server == null)
            {
                return NotFound(new { error = "Сервер не найден" });
            }

            if (server.OwnerId != userId)
            {
                return Forbid("Только владелец сервера может загружать баннер");
            }

            return Ok(new { banner = "/uploads/banners/placeholder.jpg" });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = "Произошла ошибка при загрузке баннера: " + ex.Message });
        }
    }

    [HttpDelete("{serverId}/banner")]
    public async Task<IActionResult> DeleteServerBanner(Guid serverId)
    {
        try
        {
            var userId = (Guid)HttpContext.Items["UserId"]!;
            
            var server = await _serverRepository.GetByIdAsync(serverId);
            if (server == null)
            {
                return NotFound(new { error = "Сервер не найден" });
            }

            if (server.OwnerId != userId)
            {
                return Forbid("Только владелец сервера может удалять баннер");
            }

            if (!string.IsNullOrEmpty(server.Banner))
            {
                var filePath = Path.Combine("wwwroot", server.Banner.TrimStart('/'));
                if (System.IO.File.Exists(filePath))
                {
                    System.IO.File.Delete(filePath);
                }
            }

            server.Banner = null;
            await _serverRepository.UpdateAsync(server);

            return Ok(new { message = "Баннер удален" });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = "Произошла ошибка при удалении баннера: " + ex.Message });
        }
    }

    [HttpPut("{serverId}/avatar")]
    public async Task<IActionResult> UploadServerAvatar(Guid serverId, IFormFile file)
    {
        try
        {
            var userId = (Guid)HttpContext.Items["UserId"]!;
            
            var server = await _serverRepository.GetByIdAsync(serverId);
            if (server == null)
            {
                return NotFound(new { error = "Сервер не найден" });
            }

            if (server.OwnerId != userId)
            {
                return Forbid("Только владелец сервера может загружать аватар");
            }

            return Ok(new { avatar = "/uploads/avatars/placeholder.jpg" });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = "Произошла ошибка при загрузке аватара: " + ex.Message });
        }
    }

    [HttpDelete("{serverId}/avatar")]
    public async Task<IActionResult> DeleteServerAvatar(Guid serverId)
    {
        try
        {
            var userId = (Guid)HttpContext.Items["UserId"]!;
            
            var server = await _serverRepository.GetByIdAsync(serverId);
            if (server == null)
            {
                return NotFound(new { error = "Сервер не найден" });
            }

            if (server.OwnerId != userId)
            {
                return Forbid("Только владелец сервера может удалять аватар");
            }

            if (!string.IsNullOrEmpty(server.Avatar))
            {
                var filePath = Path.Combine("wwwroot", server.Avatar.TrimStart('/'));
                if (System.IO.File.Exists(filePath))
                {
                    System.IO.File.Delete(filePath);
                }
            }

            server.Avatar = null;
            await _serverRepository.UpdateAsync(server);

            return Ok(new { message = "Аватар удален" });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = "Произошла ошибка при удалении аватара: " + ex.Message });
        }
    }

    [HttpGet("{serverId}/members")]
    public async Task<IActionResult> GetServerMembers(Guid serverId)
    {
        try
        {
            var userId = (Guid)HttpContext.Items["UserId"]!;
            
            var server = await _serverRepository.GetByIdAsync(serverId);
            if (server == null)
            {
                return NotFound(new { error = "Сервер не найден" });
            }

            var isMember = await _serverRepository.IsUserMemberAsync(serverId, userId);
            if (!isMember)
            {
                return Forbid("Вы не являетесь участником этого сервера");
            }

            var query = new GetServerMembersQuery(serverId, userId);
            var result = await _mediator.Send(query);

            if (!result.Success)
            {
                return BadRequest(new { error = result.ErrorMessage });
            }

            return Ok(result.Members);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = "Произошла ошибка при получении участников сервера: " + ex.Message });
        }
    }

    [HttpPost("{serverId}/add-member")]
    public async Task<IActionResult> AddMember(Guid serverId, [FromBody] AddMemberRequest request)
    {
        try
        {
            var userId = (Guid)HttpContext.Items["UserId"]!;
            
            var server = await _serverRepository.GetByIdAsync(serverId);
            if (server == null)
            {
                return NotFound(new { error = "Сервер не найден" });
            }

            if (server.OwnerId != userId)
            {
                return Forbid("Недостаточно прав для добавления участников");
            }

            var command = new AddMemberCommand(serverId, request.UserId);
            var result = await _mediator.Send(command);

            if (!result.Success)
            {
                return BadRequest(new { error = result.ErrorMessage });
            }

            return Ok(new { message = "Участник успешно добавлен на сервер", serverMemberId = result.ServerMemberId });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = "Произошла ошибка при добавлении участника: " + ex.Message });
        }
    }
}

public class AddMemberRequest
{
    public Guid UserId { get; set; }
}

