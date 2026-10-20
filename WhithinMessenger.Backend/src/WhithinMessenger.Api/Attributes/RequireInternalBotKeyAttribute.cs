using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.Extensions.Options;
using WhithinMessenger.Api.Options;

namespace WhithinMessenger.Api.Attributes;

[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method)]
public sealed class RequireInternalBotKeyAttribute : Attribute, IAsyncActionFilter
{
    public const string HeaderName = "X-Internal-Key";

    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        var settings = context.HttpContext.RequestServices
            .GetService(typeof(IOptions<BotPlatformSettings>)) as IOptions<BotPlatformSettings>;
        var expected = settings?.Value.InternalApiKey;
        if (string.IsNullOrWhiteSpace(expected))
        {
            context.Result = new StatusCodeResult(StatusCodes.Status503ServiceUnavailable);
            return;
        }

        if (!context.HttpContext.Request.Headers.TryGetValue(HeaderName, out var provided) ||
            !string.Equals(provided.ToString(), expected, StringComparison.Ordinal))
        {
            context.Result = new UnauthorizedObjectResult(new { error = "Invalid internal key" });
            return;
        }

        await next();
    }
}
