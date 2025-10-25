namespace WhithinMessenger.Application.Options;

/// <summary>
/// Настройки JWT токенов
/// </summary>
public class JwtSettings
{
    public const string SectionName = "JwtSettings";
    public const int RefreshTokenExpirationDays = 7;
    
    /// <summary>
    /// Издатель токена
    /// </summary>
    public required string Issuer { get; set; }
    
    /// <summary>
    /// Аудитория токена
    /// </summary>
    public required string Audience { get; set; }
    
    /// <summary>
    /// Секретный ключ для подписи
    /// </summary>
    public required string Key { get; set; }
    
    /// <summary>
    /// Время жизни токена
    /// </summary>
    public TimeSpan Ttl { get; set; }
}
