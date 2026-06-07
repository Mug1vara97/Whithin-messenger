namespace WhithinMessenger.Application.Services;

public static class ChatMessagePreviewBuilder
{
    public const string TypeText = "text";
    public const string TypeImage = "image";
    public const string TypeSticker = "sticker";
    public const string TypeVoice = "voice";
    public const string TypeVideo = "video";
    public const string TypeVideoNote = "video_note";
    public const string TypeFile = "file";

    public static (string MessageType, string PreviewText) Build(
        string? contentType,
        string? textContent,
        string? mediaContentType,
        bool isVideoNote = false)
    {
        var caption = textContent?.Trim() ?? string.Empty;

        if (string.Equals(contentType, "sticker", StringComparison.OrdinalIgnoreCase))
        {
            return (TypeSticker, "Стикер");
        }

        if (!string.IsNullOrWhiteSpace(mediaContentType))
        {
            var normalized = mediaContentType.Trim().ToLowerInvariant();

            if (isVideoNote)
            {
                return (TypeVideoNote, WithCaption("Видеосообщение", caption));
            }

            if (normalized.StartsWith("image/", StringComparison.Ordinal))
            {
                return (TypeImage, WithCaption("Фото", caption));
            }

            if (normalized.StartsWith("audio/", StringComparison.Ordinal) ||
                normalized.StartsWith("voice/", StringComparison.Ordinal))
            {
                return (TypeVoice, WithCaption("Голосовое сообщение", caption));
            }

            if (normalized.StartsWith("video/", StringComparison.Ordinal))
            {
                return (TypeVideo, WithCaption("Видео", caption));
            }

            return (TypeFile, WithCaption("Вложение", caption));
        }

        if (!string.IsNullOrWhiteSpace(caption))
        {
            return (TypeText, caption);
        }

        return (TypeText, "Новое сообщение");
    }

    public static string BuildPublicMediaUrl(string? relativePath, string publicBaseUrl = "https://whithin.ru")
    {
        if (string.IsNullOrWhiteSpace(relativePath))
        {
            return string.Empty;
        }

        var trimmed = relativePath.Trim();
        if (trimmed.StartsWith("http://", StringComparison.OrdinalIgnoreCase) ||
            trimmed.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
        {
            return trimmed;
        }

        var baseUrl = publicBaseUrl.TrimEnd('/');
        return trimmed.StartsWith('/')
            ? $"{baseUrl}{trimmed}"
            : $"{baseUrl}/{trimmed}";
    }

    private static string WithCaption(string label, string caption) =>
        string.IsNullOrWhiteSpace(caption) ? label : $"{label}: {caption}";
}
