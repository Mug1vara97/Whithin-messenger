namespace WhithinMessenger.Api.Hubs;

/// <summary>
/// Единая схема имён SignalR-групп для <see cref="AppHub"/>.
/// Все домены живут на одном хабе, поэтому имена групп обязаны иметь префикс,
/// чтобы GUID чата и GUID сервера никогда не пересекались.
/// </summary>
public static class HubGroups
{
    public static string User(Guid userId) => $"user:{userId}";
    public static string User(string userId) => $"user:{userId}";

    public static string Chat(Guid chatId) => $"chat:{chatId}";
    public static string Chat(string chatId) => Guid.TryParse(chatId, out var parsed) ? Chat(parsed) : $"chat:{chatId}";

    public static string Server(Guid serverId) => $"server:{serverId}";
    public static string Server(string serverId) => Guid.TryParse(serverId, out var parsed) ? Server(parsed) : $"server:{serverId}";

    public static string ServerList(Guid userId) => $"serverlist:{userId}";
}
