namespace WhithinMessenger.Application.Services;

public interface IProfileAudienceResolver
{
    Task<HashSet<Guid>> GetAudienceUserIdsAsync(Guid profileUserId, CancellationToken cancellationToken = default);
}
