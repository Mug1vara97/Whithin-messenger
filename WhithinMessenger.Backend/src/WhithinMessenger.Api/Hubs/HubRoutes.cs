namespace WhithinMessenger.Api.Hubs;

/// <summary>
/// Маршруты SignalR. <see cref="Primary"/> — единственный маршрут для новых клиентов.
/// <see cref="Legacy"/> — старые per-domain адреса, оставлены только для совместимости
/// с уже установленными мобильными клиентами; все они обслуживаются тем же <see cref="AppHub"/>.
/// </summary>
public static class HubRoutes
{
    public const string Primary = "/hub";

    public static readonly string[] Legacy =
    {
        "/chatlisthub",
        "/groupchathub",
        "/serverhub",
        "/serverlisthub",
        "/notificationhub",
        "/friendhub",
    };

    public static readonly string[] All = new[] { Primary }.Concat(Legacy).ToArray();

    public static bool IsHubPath(PathString path)
    {
        foreach (var route in All)
        {
            if (path.StartsWithSegments(route))
            {
                return true;
            }
        }

        return false;
    }
}
