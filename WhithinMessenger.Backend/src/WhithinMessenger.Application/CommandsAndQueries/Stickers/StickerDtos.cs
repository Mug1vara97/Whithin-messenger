namespace WhithinMessenger.Application.CommandsAndQueries.Stickers;

public class StickerPackDto
{
    public Guid Id { get; init; }
    public string Title { get; init; } = string.Empty;
    public string? CoverImagePath { get; init; }
    public DateTimeOffset CreatedAt { get; init; }
    public List<StickerDto> Stickers { get; init; } = new();
}

public class StickerDto
{
    public Guid Id { get; init; }
    public Guid StickerPackId { get; init; }
    public string FilePath { get; init; } = string.Empty;
    public string ContentType { get; init; } = string.Empty;
    public int SortOrder { get; init; }
}
