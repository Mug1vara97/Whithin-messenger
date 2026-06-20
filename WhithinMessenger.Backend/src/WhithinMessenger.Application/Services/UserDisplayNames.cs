namespace WhithinMessenger.Application.Services;

public static class UserDisplayNames
{
    public const int MaxLength = 32;

    public static string Resolve(string? displayName, string? loginName, string fallback = "Unknown")
    {
        var nick = displayName?.Trim();
        if (!string.IsNullOrEmpty(nick))
        {
            return nick;
        }

        var login = loginName?.Trim();
        if (!string.IsNullOrEmpty(login))
        {
            return login;
        }

        return fallback;
    }

    public static string? Normalize(string? value)
    {
        if (value == null)
        {
            return null;
        }

        var trimmed = value.Trim();
        return string.IsNullOrEmpty(trimmed) ? null : trimmed;
    }
}
