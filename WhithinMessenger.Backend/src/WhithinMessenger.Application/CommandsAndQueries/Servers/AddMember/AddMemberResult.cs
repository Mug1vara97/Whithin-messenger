namespace WhithinMessenger.Application.CommandsAndQueries.Servers.AddMember;

public record AddMemberResult(bool Success, string? ErrorMessage, Guid? ServerMemberId = null);

