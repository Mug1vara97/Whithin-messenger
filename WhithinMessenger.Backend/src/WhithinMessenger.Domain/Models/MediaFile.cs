namespace WhithinMessenger.Domain.Models;

public class MediaFile
{
    public Guid Id { get; set; }
    
    public Guid MessageId { get; set; }
    
    public string FileName { get; set; } = string.Empty;
    
    public string OriginalFileName { get; set; } = string.Empty;
    
    public string FilePath { get; set; } = string.Empty;
    
    public string ContentType { get; set; } = string.Empty;
    
    public long FileSize { get; set; }
    
    public string? ThumbnailPath { get; set; }
    
    public DateTimeOffset CreatedAt { get; set; }
    
    public DateTimeOffset? UpdatedAt { get; set; }
    
    public bool IsDeleted { get; set; }
    
    public Message Message { get; set; } = null!;
}















