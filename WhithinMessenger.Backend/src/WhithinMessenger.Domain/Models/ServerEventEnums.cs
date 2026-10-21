namespace WhithinMessenger.Domain.Models;

public enum ServerEventLocationType
{
    VoiceChannel = 0,
    TextChannel = 1,
    External = 2,
}

public enum ServerEventStatus
{
    Scheduled = 0,
    Canceled = 1,
}

public enum ServerEventInterest
{
    Interested = 0,
    Going = 1,
}
