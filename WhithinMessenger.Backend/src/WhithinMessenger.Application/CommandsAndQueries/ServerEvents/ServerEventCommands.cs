using MediatR;
using WhithinMessenger.Domain.Models;

namespace WhithinMessenger.Application.CommandsAndQueries.ServerEvents;

public class GetServerEventsQuery : IRequest<GetServerEventsResult>
{
    public Guid ServerId { get; }
    public Guid UserId { get; }

    public GetServerEventsQuery(Guid serverId, Guid userId)
    {
        ServerId = serverId;
        UserId = userId;
    }
}

public class GetServerEventsResult
{
    public bool Success { get; set; }
    public string? ErrorMessage { get; set; }
    public object? Events { get; set; }
}

public class CreateServerEventCommand : IRequest<ServerEventMutationResult>
{
    public Guid ServerId { get; }
    public Guid UserId { get; }
    public string Title { get; }
    public string? Description { get; }
    public DateTimeOffset StartsAt { get; }
    public DateTimeOffset? EndsAt { get; }
    public ServerEventLocationType LocationType { get; }
    public Guid? ChannelId { get; }
    public string? ExternalLocation { get; }

    public CreateServerEventCommand(
        Guid serverId,
        Guid userId,
        string title,
        string? description,
        DateTimeOffset startsAt,
        DateTimeOffset? endsAt,
        ServerEventLocationType locationType,
        Guid? channelId,
        string? externalLocation)
    {
        ServerId = serverId;
        UserId = userId;
        Title = title;
        Description = description;
        StartsAt = startsAt;
        EndsAt = endsAt;
        LocationType = locationType;
        ChannelId = channelId;
        ExternalLocation = externalLocation;
    }
}

public class UpdateServerEventCommand : IRequest<ServerEventMutationResult>
{
    public Guid EventId { get; }
    public Guid UserId { get; }
    public string Title { get; }
    public string? Description { get; }
    public DateTimeOffset StartsAt { get; }
    public DateTimeOffset? EndsAt { get; }
    public ServerEventLocationType LocationType { get; }
    public Guid? ChannelId { get; }
    public string? ExternalLocation { get; }

    public UpdateServerEventCommand(
        Guid eventId,
        Guid userId,
        string title,
        string? description,
        DateTimeOffset startsAt,
        DateTimeOffset? endsAt,
        ServerEventLocationType locationType,
        Guid? channelId,
        string? externalLocation)
    {
        EventId = eventId;
        UserId = userId;
        Title = title;
        Description = description;
        StartsAt = startsAt;
        EndsAt = endsAt;
        LocationType = locationType;
        ChannelId = channelId;
        ExternalLocation = externalLocation;
    }
}

public class CancelServerEventCommand : IRequest<ServerEventMutationResult>
{
    public Guid EventId { get; }
    public Guid UserId { get; }

    public CancelServerEventCommand(Guid eventId, Guid userId)
    {
        EventId = eventId;
        UserId = userId;
    }
}

public class SetServerEventRsvpCommand : IRequest<ServerEventMutationResult>
{
    public Guid EventId { get; }
    public Guid UserId { get; }
    public ServerEventInterest? Interest { get; }

    public SetServerEventRsvpCommand(Guid eventId, Guid userId, ServerEventInterest? interest)
    {
        EventId = eventId;
        UserId = userId;
        Interest = interest;
    }
}

public class ServerEventMutationResult
{
    public bool Success { get; set; }
    public string? ErrorMessage { get; set; }
    public Guid? ServerId { get; set; }
    public object? Event { get; set; }
}
