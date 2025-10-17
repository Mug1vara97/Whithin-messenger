using Microsoft.AspNetCore.SignalR;
using Microsoft.AspNetCore.Http;

namespace WhithinMessenger.Api.Hubs
{
    public class UserIdProvider : IUserIdProvider
    {
        public string? GetUserId(HubConnectionContext connection)
        {
            var httpContext = connection.GetHttpContext();
            if (httpContext?.User?.Identity?.IsAuthenticated == true)
            {
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
