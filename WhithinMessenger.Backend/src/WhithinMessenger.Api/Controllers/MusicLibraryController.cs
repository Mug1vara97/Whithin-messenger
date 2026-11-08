using MediatR;
using Microsoft.AspNetCore.Mvc;
using WhithinMessenger.Api.Attributes;
using WhithinMessenger.Application.CommandsAndQueries.Music.AddMusicTrack;
using WhithinMessenger.Application.CommandsAndQueries.Music.GetMusicLibrary;
using WhithinMessenger.Application.CommandsAndQueries.Music.RemoveMusicTrack;

namespace WhithinMessenger.Api.Controllers;

[ApiController]
[Route("api/music/library")]
[RequireAuth]
public class MusicLibraryController : ControllerBase
{
    private readonly IMediator _mediator;

    public MusicLibraryController(IMediator mediator)
    {
        _mediator = mediator;
    }

    [HttpGet]
    public async Task<IActionResult> GetLibrary()
    {
        try
        {
            var userId = (Guid)HttpContext.Items["UserId"]!;
            var result = await _mediator.Send(new GetMusicLibraryQuery(userId));
            if (!result.Success)
            {
                return BadRequest(new { error = result.ErrorMessage });
            }

            return Ok(result.Tracks);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = "Ошибка при получении музыки: " + ex.Message });
        }
    }

    [HttpPost]
    public async Task<IActionResult> AddTrack([FromBody] AddMusicTrackRequest request)
    {
        try
        {
            var userId = (Guid)HttpContext.Items["UserId"]!;
            var result = await _mediator.Send(new AddMusicTrackCommand(
                userId,
                request.VideoId,
                request.Title,
                request.Artist,
                request.DurationSeconds,
                request.ThumbnailUrl));
            if (!result.Success)
            {
                return BadRequest(new { error = result.ErrorMessage });
            }

            return Ok(result.Track);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = "Ошибка при добавлении трека: " + ex.Message });
        }
    }

    [HttpDelete("{videoId}")]
    public async Task<IActionResult> RemoveTrack(string videoId)
    {
        try
        {
            var userId = (Guid)HttpContext.Items["UserId"]!;
            var result = await _mediator.Send(new RemoveMusicTrackCommand(userId, videoId));
            if (!result.Success)
            {
                return BadRequest(new { error = result.ErrorMessage });
            }

            return Ok(new { success = true });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = "Ошибка при удалении трека: " + ex.Message });
        }
    }
}

public record AddMusicTrackRequest(
    string VideoId,
    string Title,
    string Artist,
    int DurationSeconds,
    string? ThumbnailUrl);
