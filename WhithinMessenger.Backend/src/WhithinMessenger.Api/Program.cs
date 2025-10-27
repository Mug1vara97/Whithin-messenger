using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using WhithinMessenger.Application;
using WhithinMessenger.Infrastructure;
using WhithinMessenger.Infrastructure.Database;
using WhithinMessenger.Api.Middleware;
using WhithinMessenger.Api.Hubs;
using WhithinMessenger.Application.Services;
using WhithinMessenger.Application.Options;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using Scalar.AspNetCore;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddOpenApi();

builder.Services.AddHttpContextAccessor();

builder.Services.AddScoped<WhithinMessenger.Application.Services.IFileService>(provider => 
{
    var logger = provider.GetRequiredService<ILogger<WhithinMessenger.Application.Services.FileService>>();
    var env = provider.GetRequiredService<IWebHostEnvironment>();
    return new WhithinMessenger.Application.Services.FileService(logger, env.WebRootPath);
});

builder.Services.AddSignalR(options =>
{
    options.EnableDetailedErrors = true;
});

builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.WithOrigins(
                  "http://localhost:5173",     
                  "https://localhost:5173",    
                  "http://localhost:3001",     
                  "https://localhost:3001",    
                  "http://whithin.ru",         
                  "https://whithin.ru"         
              )
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

// Сессии заменены на JWT токены

builder.Services.AddApplication();
builder.Services.AddInfrastructure(builder.Configuration);

// JWT Configuration - регистрируется в Infrastructure слое

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
}).AddJwtBearer(options =>
{
    var jwtSettings = builder.Configuration
        .GetRequiredSection(JwtSettings.SectionName)
        .Get<JwtSettings>()!;

    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        ValidIssuer = jwtSettings.Issuer,
        ValidAudience = jwtSettings.Audience,
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSettings.Key)),
        ClockSkew = TimeSpan.Zero
    };

    // Для SignalR
    options.Events = new JwtBearerEvents
    {
        OnMessageReceived = context =>
        {
            var accessToken = context.Request.Query["access_token"];
            var path = context.HttpContext.Request.Path;
            if (!string.IsNullOrEmpty(accessToken) && 
                (path.StartsWithSegments("/chatlisthub") || 
                 path.StartsWithSegments("/groupchathub") || 
                 path.StartsWithSegments("/serverhub") || 
                 path.StartsWithSegments("/serverlisthub")))
            {
                context.Token = accessToken;
            }
            return Task.CompletedTask;
        }
    };
});

builder.Services.AddAuthorization();


var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var services = scope.ServiceProvider;
    try
    {
        var context = services.GetRequiredService<WithinDbContext>();
        
        await context.Database.MigrateAsync();
        
        Console.WriteLine("Database migrations applied successfully");
    }
    catch (Exception ex)
    {
        var logger = services.GetRequiredService<ILogger<Program>>();
        logger.LogError(ex, "An error occurred while migrating the database.");
        throw;
    }
}

app.MapOpenApi();
app.MapScalarApiReference();

app.UseCors();
app.UseHttpsRedirection();

// JWT Authentication
app.UseAuthentication();
app.UseAuthorization();

// Custom auth middleware for setting HttpContext.Items
app.UseSimpleAuth();

// Middleware для обработки CORS для статических файлов
app.Use(async (context, next) =>
{
    if (context.Request.Path.StartsWithSegments("/uploads"))
    {
        context.Response.Headers.Append("Access-Control-Allow-Origin", "*");
        context.Response.Headers.Append("Access-Control-Allow-Methods", "GET, OPTIONS");
        context.Response.Headers.Append("Access-Control-Allow-Headers", "Content-Type");
        context.Response.Headers.Append("Cross-Origin-Resource-Policy", "cross-origin");
        
        if (context.Request.Method == "OPTIONS")
        {
            context.Response.StatusCode = 200;
            return;
        }
    }
    
    await next();
});

app.UseStaticFiles();

app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new Microsoft.Extensions.FileProviders.PhysicalFileProvider(
        Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", "uploads")),
    RequestPath = "/uploads",
    OnPrepareResponse = ctx =>
    {
        // Добавляем CORS заголовки для статических файлов
        ctx.Context.Response.Headers.Append("Access-Control-Allow-Origin", "*");
        ctx.Context.Response.Headers.Append("Access-Control-Allow-Methods", "GET");
        ctx.Context.Response.Headers.Append("Access-Control-Allow-Headers", "Content-Type");
        ctx.Context.Response.Headers.Append("Cross-Origin-Resource-Policy", "cross-origin");
    }
});


app.MapControllers();

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