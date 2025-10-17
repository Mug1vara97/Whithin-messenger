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
            context.Request.Path.StartsWithSegments("/serverlisthub"))
        {
            _logger.LogInformation($"SimpleAuthMiddleware: SignalR request, skipping auth for {context.Request.Path}");
            
            var userIdFromQuery = context.Request.Query["userId"].FirstOrDefault();
            if (!string.IsNullOrEmpty(userIdFromQuery) && Guid.TryParse(userIdFromQuery, out var signalRUserId))
            {
                _logger.LogInformation($"SimpleAuthMiddleware: Found userId in SignalR query: {signalRUserId}");
                context.Items["UserId"] = signalRUserId;
                
                var claims = new List<Claim>
                {
                    new Claim("UserId", signalRUserId.ToString()),
                    new Claim(ClaimTypes.NameIdentifier, signalRUserId.ToString())
                };
                
                var identity = new ClaimsIdentity(claims, "SimpleAuth");
                context.User = new ClaimsPrincipal(identity);
            }
            
            await _next(context);
            return;
        }

        var userIdString = context.Session.GetString("UserId");
        _logger.LogInformation($"SimpleAuthMiddleware: Session UserId: {userIdString}");
        
        if (!string.IsNullOrEmpty(userIdString) && Guid.TryParse(userIdString, out var userId))
        {
            _logger.LogInformation($"SimpleAuthMiddleware: Parsed UserId: {userId}");
            
            var claims = new List<Claim>
            {
                new Claim("UserId", userId.ToString()),
                new Claim(ClaimTypes.NameIdentifier, userId.ToString())
            };
            
            var identity = new ClaimsIdentity(claims, "SimpleAuth");
            context.User = new ClaimsPrincipal(identity);
            
            try
            {
                var userManager = context.RequestServices.GetRequiredService<UserManager<ApplicationUser>>();
                var user = await userManager.FindByIdAsync(userId.ToString());
                if (user != null)
                {
                    context.Items["User"] = user;
                    context.Items["UserId"] = user.Id;
                    _logger.LogInformation($"SimpleAuthMiddleware: User found and set in context: {user.UserName}");
                }
                else
                {
                    _logger.LogWarning($"SimpleAuthMiddleware: User not found in database for UserId: {userId}");
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"SimpleAuthMiddleware: Error finding user for UserId: {userId}");
            }
        }
        else
        {
            _logger.LogInformation($"SimpleAuthMiddleware: No valid UserId in session for {context.Request.Path}");
        }

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
