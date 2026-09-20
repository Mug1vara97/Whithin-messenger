namespace WhithinMessenger.Domain.Models;

public static class ChatTypeNames
{
    public const string Private = "Private";
    public const string Group = "Group";
    public const string TextChannel = "TextChannel";
    public const string VoiceChannel = "VoiceChannel";
    public const string IdeasBoard = "IdeasBoard";
    public const string Saved = "Saved";
    public const string News = "News";
}

public static class ChatTypeIds
{
    public static readonly Guid TextChannel = new("33333333-3333-3333-3333-333333333333");
    public static readonly Guid VoiceChannel = new("44444444-4444-4444-4444-444444444444");
    public static readonly Guid IdeasBoard = new("55555555-5555-5555-5555-555555555555");
    public static readonly Guid Saved = new("66666666-6666-6666-6666-666666666666");
    public static readonly Guid News = new("77777777-7777-7777-7777-777777777777");
}
