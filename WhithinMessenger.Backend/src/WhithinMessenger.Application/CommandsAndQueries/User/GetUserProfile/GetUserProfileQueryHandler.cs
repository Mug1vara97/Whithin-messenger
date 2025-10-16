using MediatR;
using WhithinMessenger.Domain.Interfaces;

namespace WhithinMessenger.Application.CommandsAndQueries.User.GetUserProfile;

public class GetUserProfileQueryHandler : IRequestHandler<GetUserProfileQuery, UserProfileDto?>
{
    private readonly IUserProfileRepository _userProfileRepository;

    public GetUserProfileQueryHandler(IUserProfileRepository userProfileRepository)
    {
        _userProfileRepository = userProfileRepository;
    }

    public async Task<UserProfileDto?> Handle(GetUserProfileQuery request, CancellationToken cancellationToken)
    {
        var userProfile = await _userProfileRepository.GetByUserIdAsync(request.UserId, cancellationToken);
        
        if (userProfile == null)
        {
            return null;
        }

        return new UserProfileDto
        {
            UserId = userProfile.UserId,
            Avatar = userProfile.Avatar,
            AvatarColor = userProfile.AvatarColor,
            Description = userProfile.Description,
            Banner = userProfile.Banner
        };
    }
}









