using Microsoft.AspNetCore.SignalR;
using Microsoft.AspNetCore.Http;

namespace WhithinMessenger.Api.Hubs
{
    public class UserIdProvider : IUserIdProvider
    {
        public string? GetUserId(HubConnectionContext connection)
        {
            // Получаем ID пользователя из HttpContext
            var httpContext = connection.GetHttpContext();
            if (httpContext?.User?.Identity?.IsAuthenticated == true)
            {
                // Получаем ID пользователя из Claims
                var userIdClaim = httpContext.User.FindFirst("UserId");
                if (userIdClaim != null)
                {
                    return userIdClaim.Value;
                }
            }
            
            return null;
        }
    }
}
