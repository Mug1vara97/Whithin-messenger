using Microsoft.AspNetCore.Identity;
using WhithinMessenger.Domain.Models;
using System.Security.Claims;
using Microsoft.Extensions.Logging;

namespace WhithinMessenger.Api.Middleware;

public class SimpleAuthMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<SimpleAuthMiddleware> _logger;

    public SimpleAuthMiddleware(RequestDelegate next, ILogger<SimpleAuthMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        _logger.LogInformation($"SimpleAuthMiddleware: Processing request to {context.Request.Path}");

        if (context.Request.Path.StartsWithSegments("/chatlisthub") || 
            context.Request.Path.StartsWithSegments("/groupchathub") ||
            context.Request.Path.StartsWithSegments("/serverhub") ||
            context.Request.Path.StartsWithSegments("/serverlisthub") ||
            context.Request.Path.StartsWithSegments("/notificationhub"))
        {
            _logger.LogInformation($"SimpleAuthMiddleware: SignalR request, skipping auth for {context.Request.Path}");
            
            // Для SignalR хабов используем JWT токен из query string если есть
            var accessToken = context.Request.Query["access_token"].FirstOrDefault();
            if (!string.IsNullOrEmpty(accessToken))
            {
                try
                {
                    var parts = accessToken.Split('.');
                    if (parts.Length == 3)
                    {
                        var payload = parts[1];
                        var padding = (4 - payload.Length % 4) % 4;
                        var paddedPayload = payload + new string('=', padding);
                        var decodedPayload = System.Text.Encoding.UTF8.GetString(Convert.FromBase64String(paddedPayload));
                        var payloadObj = System.Text.Json.JsonSerializer.Deserialize<Dictionary<string, object>>(decodedPayload);
                        
                        if (payloadObj.TryGetValue("UserId", out var userIdObj) && userIdObj != null)
                        {
                            var userIdString = userIdObj.ToString();
                            if (Guid.TryParse(userIdString, out var signalRUserId))
                            {
                                _logger.LogInformation($"SimpleAuthMiddleware: Found userId from JWT token in query: {signalRUserId}");
                                context.Items["UserId"] = signalRUserId;
                                
                                var claims = new List<Claim>
                                {
                                    new Claim("UserId", signalRUserId.ToString()),
                                    new Claim(ClaimTypes.NameIdentifier, signalRUserId.ToString())
                                };
                                
                                var identity = new ClaimsIdentity(claims, "JWT");
                                context.User = new ClaimsPrincipal(identity);
                                
                                await _next(context);
                                return;
                            }
                        }
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, $"SimpleAuthMiddleware: Error decoding JWT token from query string");
                }
            }
            
            // Fallback: используем userId из query string если JWT не найден
            var userIdFromQuery = context.Request.Query["userId"].FirstOrDefault();
            if (!string.IsNullOrEmpty(userIdFromQuery) && Guid.TryParse(userIdFromQuery, out var fallbackUserId))
            {
                _logger.LogInformation($"SimpleAuthMiddleware: Found userId in SignalR query: {fallbackUserId}");
                context.Items["UserId"] = fallbackUserId;
                
                var claims = new List<Claim>
                {
                    new Claim("UserId", fallbackUserId.ToString()),
                    new Claim(ClaimTypes.NameIdentifier, fallbackUserId.ToString())
                };
                
                var identity = new ClaimsIdentity(claims, "SimpleAuth");
                context.User = new ClaimsPrincipal(identity);
            }
            
            await _next(context);
            return;
        }

        // Сначала проверяем JWT токен
        var authHeader = context.Request.Headers["Authorization"].FirstOrDefault();
        if (!string.IsNullOrEmpty(authHeader) && authHeader.StartsWith("Bearer "))
        {
            var token = authHeader.Substring("Bearer ".Length).Trim();
            _logger.LogInformation($"SimpleAuthMiddleware: Found JWT token");
            
            try
            {
                // Декодируем JWT токен для получения UserId
                var parts = token.Split('.');
                if (parts.Length == 3)
                {
                    var payload = parts[1];
                    // Добавляем padding если нужно
                    var padding = (4 - payload.Length % 4) % 4;
                    var paddedPayload = payload + new string('=', padding);
                    var decodedPayload = System.Text.Encoding.UTF8.GetString(Convert.FromBase64String(paddedPayload));
                    var payloadObj = System.Text.Json.JsonSerializer.Deserialize<Dictionary<string, object>>(decodedPayload);
                    
                    if (payloadObj.TryGetValue("UserId", out var userIdObj) && userIdObj != null)
                    {
                        var userIdString = userIdObj.ToString();
                        if (Guid.TryParse(userIdString, out var userId))
                        {
                            _logger.LogInformation($"SimpleAuthMiddleware: Found UserId from JWT: {userId}");
                            
                            var claims = new List<Claim>
                            {
                                new Claim("UserId", userId.ToString()),
                                new Claim(ClaimTypes.NameIdentifier, userId.ToString())
                            };
                            
                            var identity = new ClaimsIdentity(claims, "JWT");
                            context.User = new ClaimsPrincipal(identity);
                            
                            try
                            {
                                var userManager = context.RequestServices.GetRequiredService<UserManager<ApplicationUser>>();
                                var user = await userManager.FindByIdAsync(userId.ToString());
                                if (user != null)
                                {
                                    context.Items["User"] = user;
                                    context.Items["UserId"] = user.Id;
                                    _logger.LogInformation($"SimpleAuthMiddleware: User found and set in context from JWT: {user.UserName}");
                                }
                                else
                                {
                                    _logger.LogWarning($"SimpleAuthMiddleware: User not found in database for JWT UserId: {userId}");
                                }
                            }
                            catch (Exception ex)
                            {
                                _logger.LogError(ex, $"SimpleAuthMiddleware: Error finding user for JWT UserId: {userId}");
                            }
                            
                            await _next(context);
                            return;
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"SimpleAuthMiddleware: Error decoding JWT token");
            }
        }
        
        _logger.LogInformation($"SimpleAuthMiddleware: No valid JWT token found for {context.Request.Path}");

        await _next(context);
    }
}

public static class SimpleAuthMiddlewareExtensions
{
    public static IApplicationBuilder UseSimpleAuth(this IApplicationBuilder builder)
    {
        return builder.UseMiddleware<SimpleAuthMiddleware>();
    }
}
