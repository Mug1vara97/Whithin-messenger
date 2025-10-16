﻿using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using WhithinMessenger.Domain.Interfaces;
using WhithinMessenger.Domain.Models;
using WhithinMessenger.Application.Interfaces;
using WhithinMessenger.Infrastructure.Database;
using WhithinMessenger.Infrastructure.Repositories;

namespace WhithinMessenger.Infrastructure;

public static class Infrastructure
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString("DefaultConnection");

        services.AddDbContext<WithinDbContext>(opts => opts.UseNpgsql(connectionString));

        services.AddIdentityCore<ApplicationUser>(options => { options.Password.RequireDigit = false; })
            .AddEntityFrameworkStores<WithinDbContext>();

        services.AddScoped<IChatRepository, ChatRepository>();
        services.AddScoped<IChatRepositoryExtensions, ChatRepository>();
        services.AddScoped<IUserRepository, UserRepository>();
        services.AddScoped<IUserRepositoryExtensions, UserRepository>();
        services.AddScoped<IMessageRepository, MessageRepository>();
        services.AddScoped<IMediaFileRepository, MediaFileRepository>();
        services.AddScoped<IServerRepository, ServerRepository>();
        services.AddScoped<ICategoryRepository, CategoryRepository>();
        services.AddScoped<IRoleRepository, RoleRepository>();
        services.AddScoped<IMemberRepository, MemberRepository>();
        services.AddScoped<IChatMemberRepository, ChatMemberRepository>();
        services.AddScoped<IServerMemberRepository, ServerMemberRepository>();
        services.AddScoped<IUserProfileRepository, UserProfileRepository>();
        services.AddScoped<IFriendshipRepository, FriendshipRepository>();
        
        // Обработчики команд и запросов теперь регистрируются в Application слое

        return services;
    }
}