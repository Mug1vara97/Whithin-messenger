using MediatR;
using WhithinMessenger.Application.Services;
using WhithinMessenger.Domain.Interfaces;
using WhithinMessenger.Domain.Models;

namespace WhithinMessenger.Application.CommandsAndQueries.ServerEvents;

public static class ServerEventMapper
{
    public static object Map(ServerEvent ev, Guid viewerUserId)
    {
        var interested = ev.Rsvps?.Count(r => r.Interest == ServerEventInterest.Interested) ?? 0;
        var going = ev.Rsvps?.Count(r => r.Interest == ServerEventInterest.Going) ?? 0;
        var my = ev.Rsvps?.FirstOrDefault(r => r.UserId == viewerUserId)?.Interest;

        return new
        {
            eventId = ev.Id,
            serverId = ev.ServerId,
            createdByUserId = ev.CreatedByUserId,
            createdByUsername = ev.CreatedBy?.UserName ?? string.Empty,
            title = ev.Title,
            description = ev.Description,
            startsAt = ev.StartsAt,
            endsAt = ev.EndsAt,
            locationType = ev.LocationType.ToString(),
            channelId = ev.ChannelId,
            channelName = ev.Channel?.Name,
            externalLocation = ev.ExternalLocation,
            status = ev.Status.ToString(),
            interestedCount = interested,
            goingCount = going,
            myInterest = my?.ToString(),
            createdAt = ev.CreatedAt,
            updatedAt = ev.UpdatedAt,
        };
    }
}

public class ServerEventAccessHelper
{
    private readonly IServerMemberRepository _serverMemberRepository;
    private readonly IChatRepository _chatRepository;
    private readonly ServerPermissionChecker _permissionChecker;

    public ServerEventAccessHelper(
        IServerMemberRepository serverMemberRepository,
        IChatRepository chatRepository,
        ServerPermissionChecker permissionChecker)
    {
        _serverMemberRepository = serverMemberRepository;
        _chatRepository = chatRepository;
        _permissionChecker = permissionChecker;
    }

    public async Task<bool> IsMemberAsync(Guid serverId, Guid userId, CancellationToken cancellationToken)
    {
        if (await _permissionChecker.IsOwnerAsync(serverId, userId, cancellationToken))
        {
            return true;
        }

        return await _serverMemberRepository.IsUserMemberAsync(serverId, userId, cancellationToken);
    }

    public async Task<bool> CanManageAsync(Guid serverId, Guid userId, CancellationToken cancellationToken)
    {
        if (await _permissionChecker.HasPermissionAsync(serverId, userId, "manageEvents", cancellationToken))
        {
            return true;
        }

        // Existing moderator roles often have manageServer but not yet manageEvents.
        return await _permissionChecker.HasPermissionAsync(serverId, userId, "manageServer", cancellationToken);
    }

    public async Task<string?> ValidateLocationAsync(
        Guid serverId,
        ServerEventLocationType locationType,
        Guid? channelId,
        string? externalLocation,
        CancellationToken cancellationToken)
    {
        switch (locationType)
        {
            case ServerEventLocationType.VoiceChannel:
            case ServerEventLocationType.TextChannel:
            {
                if (!channelId.HasValue)
                {
                    return "Укажите канал для мероприятия";
                }

                var chat = await _chatRepository.GetByIdAsync(channelId.Value, cancellationToken);
                if (chat == null || chat.ServerId != serverId)
                {
                    return "Канал не найден на этом сервере";
                }

                var expectedType = locationType == ServerEventLocationType.VoiceChannel
                    ? ChatTypeIds.VoiceChannel
                    : ChatTypeIds.TextChannel;

                if (chat.TypeId != expectedType)
                {
                    return locationType == ServerEventLocationType.VoiceChannel
                        ? "Выберите голосовой канал"
                        : "Выберите текстовый канал";
                }

                return null;
            }
            case ServerEventLocationType.External:
            {
                if (string.IsNullOrWhiteSpace(externalLocation))
                {
                    return "Укажите место проведения или ссылку";
                }

                if (externalLocation.Trim().Length > 500)
                {
                    return "Слишком длинное описание места";
                }

                return null;
            }
            default:
                return "Неизвестный тип места проведения";
        }
    }

    public static string? ValidateTimes(DateTimeOffset startsAt, DateTimeOffset? endsAt)
    {
        if (endsAt.HasValue && endsAt.Value <= startsAt)
        {
            return "Время окончания должно быть позже начала";
        }

        return null;
    }

    public static string? ValidateTitle(string? title)
    {
        if (string.IsNullOrWhiteSpace(title))
        {
            return "Название обязательно";
        }

        if (title.Trim().Length > 200)
        {
            return "Название слишком длинное";
        }

        return null;
    }
}

public class GetServerEventsQueryHandler : IRequestHandler<GetServerEventsQuery, GetServerEventsResult>
{
    private readonly IServerEventRepository _repository;
    private readonly ServerEventAccessHelper _access;

    public GetServerEventsQueryHandler(IServerEventRepository repository, ServerEventAccessHelper access)
    {
        _repository = repository;
        _access = access;
    }

    public async Task<GetServerEventsResult> Handle(GetServerEventsQuery request, CancellationToken cancellationToken)
    {
        if (!await _access.IsMemberAsync(request.ServerId, request.UserId, cancellationToken))
        {
            return new GetServerEventsResult { Success = false, ErrorMessage = "Нет доступа к серверу" };
        }

        var from = DateTimeOffset.UtcNow.AddDays(-1);
        var to = DateTimeOffset.UtcNow.AddDays(90);
        var events = await _repository.GetByServerAsync(request.ServerId, from, to, cancellationToken);

        return new GetServerEventsResult
        {
            Success = true,
            Events = events.Select(e => ServerEventMapper.Map(e, request.UserId)).ToList(),
        };
    }
}

public class CreateServerEventCommandHandler : IRequestHandler<CreateServerEventCommand, ServerEventMutationResult>
{
    private readonly IServerEventRepository _repository;
    private readonly ServerEventAccessHelper _access;

    public CreateServerEventCommandHandler(IServerEventRepository repository, ServerEventAccessHelper access)
    {
        _repository = repository;
        _access = access;
    }

    public async Task<ServerEventMutationResult> Handle(CreateServerEventCommand request, CancellationToken cancellationToken)
    {
        if (!await _access.CanManageAsync(request.ServerId, request.UserId, cancellationToken))
        {
            return new ServerEventMutationResult { Success = false, ErrorMessage = "Недостаточно прав для управления мероприятиями" };
        }

        var titleError = ServerEventAccessHelper.ValidateTitle(request.Title);
        if (titleError != null)
        {
            return new ServerEventMutationResult { Success = false, ErrorMessage = titleError };
        }

        var timeError = ServerEventAccessHelper.ValidateTimes(request.StartsAt, request.EndsAt);
        if (timeError != null)
        {
            return new ServerEventMutationResult { Success = false, ErrorMessage = timeError };
        }

        var locationError = await _access.ValidateLocationAsync(
            request.ServerId, request.LocationType, request.ChannelId, request.ExternalLocation, cancellationToken);
        if (locationError != null)
        {
            return new ServerEventMutationResult { Success = false, ErrorMessage = locationError };
        }

        var now = DateTimeOffset.UtcNow;
        var entity = new ServerEvent
        {
            Id = Guid.NewGuid(),
            ServerId = request.ServerId,
            CreatedByUserId = request.UserId,
            Title = request.Title.Trim(),
            Description = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim(),
            StartsAt = request.StartsAt.ToUniversalTime(),
            EndsAt = request.EndsAt?.ToUniversalTime(),
            LocationType = request.LocationType,
            ChannelId = request.LocationType == ServerEventLocationType.External ? null : request.ChannelId,
            ExternalLocation = request.LocationType == ServerEventLocationType.External
                ? request.ExternalLocation!.Trim()
                : null,
            Status = ServerEventStatus.Scheduled,
            CreatedAt = now,
            UpdatedAt = now,
        };

        await _repository.CreateAsync(entity, cancellationToken);
        var loaded = await _repository.GetByIdAsync(entity.Id, cancellationToken);
        return new ServerEventMutationResult
        {
            Success = true,
            ServerId = request.ServerId,
            Event = loaded == null ? null : ServerEventMapper.Map(loaded, request.UserId),
        };
    }
}

public class UpdateServerEventCommandHandler : IRequestHandler<UpdateServerEventCommand, ServerEventMutationResult>
{
    private readonly IServerEventRepository _repository;
    private readonly ServerEventAccessHelper _access;

    public UpdateServerEventCommandHandler(IServerEventRepository repository, ServerEventAccessHelper access)
    {
        _repository = repository;
        _access = access;
    }

    public async Task<ServerEventMutationResult> Handle(UpdateServerEventCommand request, CancellationToken cancellationToken)
    {
        var entity = await _repository.GetByIdAsync(request.EventId, cancellationToken);
        if (entity == null)
        {
            return new ServerEventMutationResult { Success = false, ErrorMessage = "Мероприятие не найдено" };
        }

        if (entity.Status == ServerEventStatus.Canceled)
        {
            return new ServerEventMutationResult { Success = false, ErrorMessage = "Мероприятие отменено" };
        }

        if (!await _access.CanManageAsync(entity.ServerId, request.UserId, cancellationToken))
        {
            return new ServerEventMutationResult { Success = false, ErrorMessage = "Недостаточно прав для управления мероприятиями" };
        }

        var titleError = ServerEventAccessHelper.ValidateTitle(request.Title);
        if (titleError != null)
        {
            return new ServerEventMutationResult { Success = false, ErrorMessage = titleError };
        }

        var timeError = ServerEventAccessHelper.ValidateTimes(request.StartsAt, request.EndsAt);
        if (timeError != null)
        {
            return new ServerEventMutationResult { Success = false, ErrorMessage = timeError };
        }

        var locationError = await _access.ValidateLocationAsync(
            entity.ServerId, request.LocationType, request.ChannelId, request.ExternalLocation, cancellationToken);
        if (locationError != null)
        {
            return new ServerEventMutationResult { Success = false, ErrorMessage = locationError };
        }

        entity.Title = request.Title.Trim();
        entity.Description = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim();
        entity.StartsAt = request.StartsAt.ToUniversalTime();
        entity.EndsAt = request.EndsAt?.ToUniversalTime();
        entity.LocationType = request.LocationType;
        entity.ChannelId = request.LocationType == ServerEventLocationType.External ? null : request.ChannelId;
        entity.ExternalLocation = request.LocationType == ServerEventLocationType.External
            ? request.ExternalLocation!.Trim()
            : null;
        entity.UpdatedAt = DateTimeOffset.UtcNow;

        await _repository.UpdateAsync(entity, cancellationToken);
        var loaded = await _repository.GetByIdAsync(entity.Id, cancellationToken);
        return new ServerEventMutationResult
        {
            Success = true,
            ServerId = entity.ServerId,
            Event = loaded == null ? null : ServerEventMapper.Map(loaded, request.UserId),
        };
    }
}

public class CancelServerEventCommandHandler : IRequestHandler<CancelServerEventCommand, ServerEventMutationResult>
{
    private readonly IServerEventRepository _repository;
    private readonly ServerEventAccessHelper _access;

    public CancelServerEventCommandHandler(IServerEventRepository repository, ServerEventAccessHelper access)
    {
        _repository = repository;
        _access = access;
    }

    public async Task<ServerEventMutationResult> Handle(CancelServerEventCommand request, CancellationToken cancellationToken)
    {
        var entity = await _repository.GetByIdAsync(request.EventId, cancellationToken);
        if (entity == null)
        {
            return new ServerEventMutationResult { Success = false, ErrorMessage = "Мероприятие не найдено" };
        }

        if (!await _access.CanManageAsync(entity.ServerId, request.UserId, cancellationToken))
        {
            return new ServerEventMutationResult { Success = false, ErrorMessage = "Недостаточно прав для управления мероприятиями" };
        }

        if (entity.Status == ServerEventStatus.Canceled)
        {
            return new ServerEventMutationResult
            {
                Success = true,
                ServerId = entity.ServerId,
                Event = ServerEventMapper.Map(entity, request.UserId),
            };
        }

        entity.Status = ServerEventStatus.Canceled;
        entity.UpdatedAt = DateTimeOffset.UtcNow;
        await _repository.UpdateAsync(entity, cancellationToken);

        var loaded = await _repository.GetByIdAsync(entity.Id, cancellationToken);
        return new ServerEventMutationResult
        {
            Success = true,
            ServerId = entity.ServerId,
            Event = loaded == null ? null : ServerEventMapper.Map(loaded, request.UserId),
        };
    }
}

public class SetServerEventRsvpCommandHandler : IRequestHandler<SetServerEventRsvpCommand, ServerEventMutationResult>
{
    private readonly IServerEventRepository _repository;
    private readonly ServerEventAccessHelper _access;

    public SetServerEventRsvpCommandHandler(IServerEventRepository repository, ServerEventAccessHelper access)
    {
        _repository = repository;
        _access = access;
    }

    public async Task<ServerEventMutationResult> Handle(SetServerEventRsvpCommand request, CancellationToken cancellationToken)
    {
        var entity = await _repository.GetByIdAsync(request.EventId, cancellationToken);
        if (entity == null)
        {
            return new ServerEventMutationResult { Success = false, ErrorMessage = "Мероприятие не найдено" };
        }

        if (entity.Status == ServerEventStatus.Canceled)
        {
            return new ServerEventMutationResult { Success = false, ErrorMessage = "Мероприятие отменено" };
        }

        if (!await _access.IsMemberAsync(entity.ServerId, request.UserId, cancellationToken))
        {
            return new ServerEventMutationResult { Success = false, ErrorMessage = "Нет доступа к серверу" };
        }

        await _repository.SetRsvpAsync(request.EventId, request.UserId, request.Interest, cancellationToken);
        var loaded = await _repository.GetByIdAsync(request.EventId, cancellationToken);
        return new ServerEventMutationResult
        {
            Success = true,
            ServerId = entity.ServerId,
            Event = loaded == null ? null : ServerEventMapper.Map(loaded, request.UserId),
        };
    }
}
