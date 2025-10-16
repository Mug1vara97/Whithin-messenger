using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using WhithinMessenger.Application;
using WhithinMessenger.Infrastructure;
using WhithinMessenger.Infrastructure.Database;
using WhithinMessenger.Api.Middleware;
using WhithinMessenger.Api.Hubs;
using WhithinMessenger.Api.HttpHandlers;
using Scalar.AspNetCore;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddOpenApi();

// Добавляем HttpContextAccessor для SignalR
builder.Services.AddHttpContextAccessor();

builder.Services.AddSignalR(options =>
{
    options.EnableDetailedErrors = true;
});

// SignalR настройки

// Добавляем CORS
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.WithOrigins(
                  "http://localhost:5173",     // Vite dev server
                  "https://localhost:5173",    // Vite dev server (HTTPS)
                  "http://localhost:3001",     // Docker client
                  "https://localhost:3001",    // Docker client (HTTPS)
                  "http://whithin.ru",         // Production domain
                  "https://whithin.ru"         // Production domain (HTTPS)
              )
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials(); // Важно для сессий
    });
});

// Добавляем поддержку сессий
builder.Services.AddDistributedMemoryCache();
builder.Services.AddSession(options =>
{
    options.IdleTimeout = TimeSpan.FromMinutes(30);
    options.Cookie.HttpOnly = true;
    options.Cookie.IsEssential = true;
});

builder.Services.AddApplication();
builder.Services.AddInfrastructure(builder.Configuration);


var app = builder.Build();

// Автоматическая миграция базы данных при запуске
using (var scope = app.Services.CreateScope())
{
    var services = scope.ServiceProvider;
    try
    {
        var context = services.GetRequiredService<WithinDbContext>();
        
        // Применяем все pending миграции
        await context.Database.MigrateAsync();
        
        Console.WriteLine("✅ Database migrations applied successfully");
    }
    catch (Exception ex)
    {
        var logger = services.GetRequiredService<ILogger<Program>>();
        logger.LogError(ex, "❌ An error occurred while migrating the database.");
        throw;
    }
}

app.MapOpenApi();
app.MapScalarApiReference();

app.UseCors();
app.UseHttpsRedirection();

// Настройка статических файлов для медиафайлов
app.UseStaticFiles();

// Дополнительная настройка для папки uploads
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new Microsoft.Extensions.FileProviders.PhysicalFileProvider(
        Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", "uploads")),
    RequestPath = "/uploads"
});

app.UseSession();
app.UseSimpleAuth();

app.MapControllers();

// Настраиваем SignalR хабы
app.MapHub<ChatListHub>("/chatlisthub", options =>
{
    options.Transports = Microsoft.AspNetCore.Http.Connections.HttpTransportType.WebSockets;
});

app.MapHub<GroupChatHub>("/groupchathub", options =>
{
    options.Transports = Microsoft.AspNetCore.Http.Connections.HttpTransportType.WebSockets;
});

app.MapHub<ServerHub>("/serverhub", options =>
{
    options.Transports = Microsoft.AspNetCore.Http.Connections.HttpTransportType.WebSockets;
});

app.MapHub<ServerListHub>("/serverlisthub", options =>
{
    options.Transports = Microsoft.AspNetCore.Http.Connections.HttpTransportType.WebSockets;
});

app.Run();