using MediatR;
using WhithinMessenger.Domain.Interfaces;

namespace WhithinMessenger.Application.CommandsAndQueries.Chats.GetChatParticipants
{
    public class GetChatParticipantsQueryHandler : IRequestHandler<GetChatParticipantsQuery, GetChatParticipantsResult>
    {
        private readonly IChatRepository _chatRepository;

        public GetChatParticipantsQueryHandler(IChatRepository chatRepository)
        {
            _chatRepository = chatRepository;
        }

        public async Task<GetChatParticipantsResult> Handle(GetChatParticipantsQuery request, CancellationToken cancellationToken)
        {
            try
            {
                var participants = await _chatRepository.GetChatParticipantsAsync(request.ChatId, cancellationToken);
                
                Console.WriteLine($"GetChatParticipants - ChatId: {request.ChatId}");
                Console.WriteLine($"Found {participants.Count} participants for chat {request.ChatId}");
                foreach (var participant in participants)
                {
                    Console.WriteLine($"  - {participant.Username} (ID: {participant.UserId})");
                }

                return new GetChatParticipantsResult
                {
                    Success = true,
                    Participants = participants
                };
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error getting chat participants: {ex.Message}");
                return new GetChatParticipantsResult
                {
                    Success = false,
                    ErrorMessage = "Произошла ошибка при получении участников чата: " + ex.Message
                };
            }
        }
    }
}
