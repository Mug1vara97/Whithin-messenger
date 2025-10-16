using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using WhithinMessenger.Domain.Models;

namespace WhithinMessenger.Api.Attributes;

public class RequireAuthAttribute : ActionFilterAttribute
{
    public override void OnActionExecuting(ActionExecutingContext context)
    {
        var user = context.HttpContext.Items["User"] as ApplicationUser;
        
        if (user == null)
        {
            context.Result = new UnauthorizedObjectResult(new { Error = "Требуется авторизация" });
            return;
        }
        
        base.OnActionExecuting(context);
    }
}

