namespace WhithinMessenger.Application.Options;

public class RedisCacheSettings
{
    public const string SectionName = "Redis";

    /// <summary>Cache TTL for per-user chat/server lists.</summary>
    public int UserListTtlSeconds { get; set; } = 45;
}
