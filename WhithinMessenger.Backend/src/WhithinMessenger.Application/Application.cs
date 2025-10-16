﻿using System.Reflection;
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
        
        // Регистрируем сервисы для работы с файлами
        services.AddScoped<IFileService>(provider => 
        {
            var logger = provider.GetRequiredService<ILogger<FileService>>();
            return new FileService(logger, "wwwroot");
        });
        
        return services;
    } 
}