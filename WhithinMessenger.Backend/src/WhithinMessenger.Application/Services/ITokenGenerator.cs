namespace WhithinMessenger.Application.Services;

/// <summary>
/// Сервис для генерации JWT токенов
/// </summary>
public interface ITokenGenerator
{
    /// <summary>
    /// Генерирует JWT токен доступа
    /// </summary>
    /// <param name="userId">ID пользователя</param>
    /// <param name="username">Имя пользователя</param>
    /// <param name="email">Email пользователя</param>
    /// <returns>JWT токен</returns>
    string GenerateAccessToken(string userId, string username, string email);
    
    /// <summary>
    /// Генерирует refresh токен
    /// </summary>
    /// <returns>Refresh токен</returns>
    string GenerateRefreshToken();
}
