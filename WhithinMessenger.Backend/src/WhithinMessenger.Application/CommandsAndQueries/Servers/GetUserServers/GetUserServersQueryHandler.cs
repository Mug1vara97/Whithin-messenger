using MediatR;
using WhithinMessenger.Application.Models;
using WhithinMessenger.Application.Services;
using WhithinMessenger.Domain.Interfaces;

namespace WhithinMessenger.Application.CommandsAndQueries.Servers;

public class GetUserServersQueryHandler : IRequestHandler<GetUserServersQuery, GetUserServersResult>
{
    private readonly IServerRepository _serverRepository;
    private readonly IUserListCacheService _userListCache;

    public GetUserServersQueryHandler(IServerRepository serverRepository, IUserListCacheService userListCache)
    {
        _serverRepository = serverRepository;
        _userListCache = userListCache;
    }

    public async Task<GetUserServersResult> Handle(GetUserServersQuery request, CancellationToken cancellationToken)
    {
        try
        {
            var cached = await _userListCache.GetUserServersAsync(request.UserId, cancellationToken);
            if (cached != null)
            {
                return new GetUserServersResult
                {
                    Success = true,
                    Servers = cached.Select(s => s.ToApiObject()).Cast<object>().ToList(),
                };
            }

            var servers = await _serverRepository.GetUserServersAsync(request.UserId, cancellationToken);

            var items = servers.Select(s => new CachedUserServerItem
            {
                ServerId = s.Id,
                Name = s.Name,
                OwnerId = s.OwnerId,
                CreatedAt = s.CreatedAt,
                IsPublic = s.IsPublic,
                Description = s.Description,
                Avatar = s.Avatar,
                Banner = s.Banner,
                BannerColor = s.BannerColor,
            }).ToList();

            await _userListCache.SetUserServersAsync(request.UserId, items, cancellationToken);

            return new GetUserServersResult
            {
                Success = true,
                Servers = items.Select(s => s.ToApiObject()).Cast<object>().ToList(),
            };
        }
        catch (Exception ex)
        {
            return new GetUserServersResult
            {
                Success = false,
                ErrorMessage = ex.Message
            };
        }
    }
}
























