using System.Reflection;
using FluentValidation;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using WhithinMessenger.Application.CommandsAndQueries.IdeaBoard;
using WhithinMessenger.Application.Services;
using WhithinMessenger.Application.Stickers;

namespace WhithinMessenger.Application;

public static class Application
{
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        services.AddValidatorsFromAssembly(Assembly.GetExecutingAssembly());
        services.AddMediatR(x => x.RegisterServicesFromAssembly(Assembly.GetExecutingAssembly()));
        services.AddScoped<ServerPermissionChecker>();
        services.AddScoped<IUserBlockService, UserBlockService>();
        services.AddScoped<IServerAuditLogService, ServerAuditLogService>();
        services.AddScoped<IMediaFileStorageCleanup, MediaFileStorageCleanup>();
        services.AddScoped<IdeaBoardAccessHelper>();
        services.AddScoped<IStickerFileProcessingService, StickerFileProcessingService>();
        
        // FileService регистрируется в Program.cs с использованием IWebHostEnvironment
        // NotificationService регистрируется в Program.cs после добавления SignalR
        
        return services;
    } 
}