using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.Options;
using WhithinMessenger.Api.Attributes;
using WhithinMessenger.Api.Options;

namespace WhithinMessenger.Api.Services;

public class BotEventForwarder : IBotEventForwarder
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };

    private readonly IHttpClientFactory _httpClientFactory;
    private readonly BotPlatformSettings _settings;
    private readonly ILogger<BotEventForwarder> _logger;

    public BotEventForwarder(
        IHttpClientFactory httpClientFactory,
        IOptions<BotPlatformSettings> settings,
        ILogger<BotEventForwarder> logger)
    {
        _httpClientFactory = httpClientFactory;
        _settings = settings.Value;
        _logger = logger;
    }

    public Task ForwardMessageCreatedAsync(
        Guid chatId,
        Guid messageId,
        Guid senderId,
        string content,
        string? senderUsername,
        Guid? serverId = null,
        CancellationToken cancellationToken = default) =>
        PostEventAsync(
            "message.created",
            new
            {
                chatId,
                messageId,
                senderId,
                content,
                senderUsername,
                serverId,
                date = DateTimeOffset.UtcNow.ToUnixTimeSeconds(),
            },
            cancellationToken);

    public Task ForwardMessageUpdatedAsync(
        Guid chatId,
        Guid messageId,
        Guid senderId,
        string content,
        CancellationToken cancellationToken = default) =>
        PostEventAsync(
            "message.updated",
            new { chatId, messageId, senderId, content },
            cancellationToken);

    public Task ForwardMessageDeletedAsync(
        Guid chatId,
        Guid messageId,
        CancellationToken cancellationToken = default) =>
        PostEventAsync(
            "message.deleted",
            new { chatId, messageId },
            cancellationToken);

    public Task ForwardMemberJoinedAsync(
        Guid serverId,
        string? serverName,
        Guid userId,
        string? username,
        CancellationToken cancellationToken = default) =>
        PostEventAsync(
            "member.joined",
            new
            {
                serverId,
                serverName,
                userId,
                username,
                date = DateTimeOffset.UtcNow.ToUnixTimeSeconds(),
            },
            cancellationToken);

    private async Task PostEventAsync(string type, object payload, CancellationToken cancellationToken)
    {
        if (!_settings.ForwardEvents || string.IsNullOrWhiteSpace(_settings.BotServiceBaseUrl))
        {
            return;
        }

        try
        {
            var client = _httpClientFactory.CreateClient("bot-service");
            using var request = new HttpRequestMessage(
                HttpMethod.Post,
                $"{_settings.BotServiceBaseUrl.TrimEnd('/')}/internal/v1/events");
            request.Headers.TryAddWithoutValidation(
                RequireInternalBotKeyAttribute.HeaderName,
                _settings.InternalApiKey);
            request.Content = JsonContent.Create(new { type, payload }, options: JsonOptions);

            using var response = await client.SendAsync(request, cancellationToken);
            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning(
                    "Bot event {Type} forward failed: {Status}",
                    type,
                    (int)response.StatusCode);
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Bot event {Type} forward error", type);
        }
    }
}
