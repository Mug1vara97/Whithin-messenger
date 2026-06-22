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

    /// <summary>Видеосообщение «кружок» (как в Telegram): круглый превью в чате.</summary>
    public bool IsVideoNote { get; set; }

    /// <summary>Длительность аудио/видео в секундах (для голосовых сообщений и t.п.).</summary>
    public double? DurationSeconds { get; set; }

    /// <summary>HLS master.m3u8 для адаптивного стриминга (несколько качеств).</summary>
    public string? StreamingManifestPath { get; set; }
    
    public Message Message { get; set; } = null!;
}















