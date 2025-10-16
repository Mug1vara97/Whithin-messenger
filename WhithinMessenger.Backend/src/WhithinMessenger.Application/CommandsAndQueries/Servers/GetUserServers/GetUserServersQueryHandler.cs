using MediatR;
using WhithinMessenger.Domain.Interfaces;

namespace WhithinMessenger.Application.CommandsAndQueries.Servers;

public class GetUserServersQueryHandler : IRequestHandler<GetUserServersQuery, GetUserServersResult>
{
    private readonly IServerRepository _serverRepository;

    public GetUserServersQueryHandler(IServerRepository serverRepository)
    {
        _serverRepository = serverRepository;
    }

    public async Task<GetUserServersResult> Handle(GetUserServersQuery request, CancellationToken cancellationToken)
    {
        try
        {
            var servers = await _serverRepository.GetUserServersAsync(request.UserId, cancellationToken);
            
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
                bannerColor = s.BannerColor
            }).ToList();

            return new GetUserServersResult
            {
                Success = true,
                Servers = serverDtos.Cast<object>().ToList()
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
























