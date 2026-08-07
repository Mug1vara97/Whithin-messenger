using System.Text.Json;
using Microsoft.AspNetCore.Mvc;

namespace WhithinMessenger.MusicSignal;

[ApiController]
[Route("api/music-relay")]
public sealed class MusicRelayController : ControllerBase
{
    private readonly SyncRelayStore _store;

    public MusicRelayController(SyncRelayStore store)
    {
        _store = store;
    }

    public sealed record CreateSessionRequest(string MusicUserId, string FromDeviceId, string ToDeviceId);

    [HttpPost("sessions")]
    public ActionResult<object> CreateSession([FromBody] CreateSessionRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.MusicUserId) ||
            string.IsNullOrWhiteSpace(req.FromDeviceId) ||
            string.IsNullOrWhiteSpace(req.ToDeviceId))
        {
            return BadRequest("musicUserId, fromDeviceId, toDeviceId required");
        }

        var id = _store.CreateSession(req.MusicUserId.Trim(), req.FromDeviceId.Trim(), req.ToDeviceId.Trim());
        return Ok(new { sessionId = id });
    }

    [HttpPut("sessions/{sessionId}/files/{hash}")]
    public async Task<IActionResult> PutFile(string sessionId, string hash,
        [FromQuery] string fileName,
        [FromQuery] string? metaJson = null)
    {
        using var ms = new MemoryStream();
        await Request.Body.CopyToAsync(ms);
        if (!_store.PutFile(sessionId, hash, fileName, metaJson ?? "{}", ms.ToArray()))
            return NotFound();
        return Ok(new { hash, size = ms.Length });
    }

    [HttpGet("sessions/{sessionId}/files")]
    public ActionResult<object> ListFiles(string sessionId)
    {
        return Ok(new { hashes = _store.ListHashes(sessionId) });
    }

    [HttpGet("sessions/{sessionId}/files/{hash}")]
    public IActionResult GetFile(string sessionId, string hash)
    {
        var file = _store.GetFile(sessionId, hash);
        if (file is null) return NotFound();
        Response.Headers["X-File-Name"] = file.FileName;
        Response.Headers["X-Meta-Json"] = file.MetaJson;
        return File(file.Data, "application/octet-stream", file.FileName);
    }

    [HttpDelete("sessions/{sessionId}")]
    public IActionResult Complete(string sessionId)
    {
        _store.Complete(sessionId);
        return NoContent();
    }

    [HttpGet("ice")]
    public ActionResult<object> IceServers()
    {
        // Same coturn as Whithin-messenger voice
        return Ok(new
        {
            iceServers = new object[]
            {
                new { urls = new[] { "stun:185.119.59.23:3478" } },
                new
                {
                    urls = new[] { "turn:185.119.59.23:3478?transport=udp" },
                    username = "test",
                    credential = "test123"
                },
                new
                {
                    urls = new[] { "turn:185.119.59.23:3478?transport=tcp" },
                    username = "test",
                    credential = "test123"
                }
            }
        });
    }
}
