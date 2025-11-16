using System.Reflection;
using FluentValidation;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using WhithinMessenger.Application.Services;

namespace WhithinMessenger.Application;

public static class Application
{
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        services.AddValidatorsFromAssembly(Assembly.GetExecutingAssembly());
        services.AddMediatR(x => x.RegisterServicesFromAssembly(Assembly.GetExecutingAssembly()));
        
        // FileService регистрируется в Program.cs с использованием IWebHostEnvironment
        // NotificationService регистрируется в Program.cs после добавления SignalR
        
        return services;
    } 
}