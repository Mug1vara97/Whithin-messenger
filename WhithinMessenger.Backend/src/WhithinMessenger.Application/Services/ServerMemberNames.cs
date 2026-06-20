namespace WhithinMessenger.Application.Services;

public static class ServerMemberNames
{
    public static string Resolve(
        string? serverNickname,
        string? displayName,
        string? loginName,
        string fallback = "Unknown")
    {
        var serverNick = UserDisplayNames.Normalize(serverNickname);
        if (serverNick != null)
        {
            return serverNick;
        }

        return UserDisplayNames.Resolve(displayName, loginName, fallback);
    }
}
