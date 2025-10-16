using Microsoft.AspNetCore.Http;

namespace WhithinMessenger.Api.HttpHandlers
{
    public class SessionHttpHandler : DelegatingHandler
    {
        private readonly IHttpContextAccessor _httpContextAccessor;

        public SessionHttpHandler(IHttpContextAccessor httpContextAccessor)
        {
            _httpContextAccessor = httpContextAccessor;
        }

        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            var httpContext = _httpContextAccessor.HttpContext;
            if (httpContext != null)
            {
                // Передаем куки сессии
                var cookies = httpContext.Request.Headers.Cookie;
                if (!string.IsNullOrEmpty(cookies))
                {
                    request.Headers.Add("Cookie", cookies.ToString());
                }
            }

            return await base.SendAsync(request, cancellationToken);
        }
    }
}
