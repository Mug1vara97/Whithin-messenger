using MediatR;
using WhithinMessenger.Domain.Interfaces;

namespace WhithinMessenger.Application.CommandsAndQueries.Servers;

public class GetPublicServersQueryHandler : IRequestHandler<GetPublicServersQuery, GetPublicServersResult>
{
    private readonly IServerRepository _serverRepository;

    public GetPublicServersQueryHandler(IServerRepository serverRepository)
    {
        _serverRepository = serverRepository;
    }

    public async Task<GetPublicServersResult> Handle(GetPublicServersQuery request, CancellationToken cancellationToken)
    {
        try
        {
            var servers = await _serverRepository.GetPublicServersAsync(cancellationToken);
            
            var serverDtos = servers.Select(s => new
            {
                serverId = s.Id,
                name = s.Name,
                ownerId = s.OwnerId,
                createdAt = s.CreatedAt,
                isPublic = s.IsPublic,
                description = s.Description,
                avatar = s.Avatar,
                banner = s.Banner,
                bannerColor = s.BannerColor,
                memberCount = s.ServerMembers?.Count ?? 0
            }).ToList();

            return new GetPublicServersResult
            {
                Success = true,
                Servers = serverDtos.Cast<object>().ToList()
            };
        }
        catch (Exception ex)
        {
            return new GetPublicServersResult
            {
                Success = false,
                ErrorMessage = ex.Message
            };
        }
    }
}
