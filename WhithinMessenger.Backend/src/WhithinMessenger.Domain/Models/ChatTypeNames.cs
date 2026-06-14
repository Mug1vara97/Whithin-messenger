namespace WhithinMessenger.Domain.Models;

public static class ChatTypeNames
{
    public const string Private = "Private";
    public const string Group = "Group";
    public const string TextChannel = "TextChannel";
    public const string VoiceChannel = "VoiceChannel";
    public const string Saved = "Saved";
}

public static class ChatTypeIds
{
    public static readonly Guid Saved = new("55555555-5555-5555-5555-555555555555");
}
