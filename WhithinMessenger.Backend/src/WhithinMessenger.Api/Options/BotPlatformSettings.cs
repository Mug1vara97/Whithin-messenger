namespace WhithinMessenger.Api.Options;

public class BotPlatformSettings
{
    public const string SectionName = "BotPlatform";

    /// <summary>Shared secret for /api/internal/bots/* and Go → C# calls.</summary>
    public string InternalApiKey { get; set; } = "whithin-bot-internal-dev-key";

    /// <summary>Base URL of the Go bot-service (e.g. http://bot-service:8091).</summary>
    public string BotServiceBaseUrl { get; set; } = "http://bot-service:8091";

    public bool ForwardEvents { get; set; } = true;
}
