# Backend - WhithinMessenger

ASP.NET Core 8.0 Web API с Clean Architecture + CQRS.

## Архитектура

**Clean Architecture + CQRS:**
```
Api (Controllers, Hubs)
  ↓
Application (Commands, Queries via MediatR)
  ↓
Domain (Entities, Interfaces)
  ↓
Infrastructure (Database, Repositories)
```

## Структура проекта

```
src/
├── WhithinMessenger.Api/
│   ├── Controllers/          # HTTP endpoints
│   ├── Hubs/                 # SignalR hubs
│   ├── Middleware/           # Auth, etc.
│   └── Program.cs
│
├── WhithinMessenger.Application/
│   ├── CommandsAndQueries/   # CQRS
│   │   ├── Auth/
│   │   ├── Chats/
│   │   ├── Messages/
│   │   └── Servers/
│   ├── Services/             # Business services
│   └── Validators/           # FluentValidation
│
├── WhithinMessenger.Domain/
│   ├── Models/               # Entities
│   └── Interfaces/           # Repository contracts
│
└── WhithinMessenger.Infrastructure/
    ├── Database/
    │   ├── WithinDbContext.cs
    │   └── Configurations/
    ├── Repositories/
    └── Migrations/
```

## Технологии

- ASP.NET Core 8.0
- PostgreSQL + Entity Framework Core
- MediatR (CQRS)
- SignalR (WebSockets)
- FluentValidation
- Scalar (OpenAPI docs)

## Быстрый старт

```bash
cd src/WhithinMessenger.Api

# Обновить appsettings.Development.json
# Применить миграции
dotnet ef database update --project ../WhithinMessenger.Infrastructure

# Запустить
dotnet run  # https://localhost:5117

# С hot-reload
dotnet watch run
```

## API Endpoints

См. [Endpoints.md](../WhithinMessenger.Backend/Endpoints.md) для полного списка.

**Основные группы:**
- `/api/auth` - Аутентификация
- `/api/chats` - Чаты и сообщения
- `/api/servers` - Серверы и каналы
- `/api/friends` - Система друзей
- `/api/media` - Загрузка файлов

**Документация:** https://localhost:5117/scalar/v1

## SignalR Hubs

| Hub | URL | Назначение |
|-----|-----|------------|
| GroupChatHub | `/groupchathub` | Сообщения в чатах |
| ChatListHub | `/chatlisthub` | Список чатов |
| ServerHub | `/serverhub` | События серверов |
| ServerListHub | `/serverlisthub` | Список серверов |

### Пример использования

```csharp
// Клиент вызывает
await connection.invoke('SendMessage', chatId, content);

// Hub обрабатывает через MediatR
var command = new SendMessageCommand(chatId, content, userId);
var result = await _mediator.Send(command);

// Уведомляет всех клиентов
await Clients.Group(chatId).SendAsync("ReceiveMessage", messageDto);
```

## CQRS Pattern

### Command (изменяет данные)

```csharp
// Command
public record SendMessageCommand(
    Guid ChatId,
    string Content,
    Guid SenderId
) : IRequest<Result<MessageDto>>;

// Validator
public class SendMessageCommandValidator : AbstractValidator<SendMessageCommand>
{
    public SendMessageCommandValidator()
    {
        RuleFor(x => x.Content).NotEmpty().MaximumLength(5000);
    }
}

// Handler
public class SendMessageCommandHandler : IRequestHandler<SendMessageCommand, Result<MessageDto>>
{
    public async Task<Result<MessageDto>> Handle(...)
    {
        var message = new Message { ... };
        await _messageRepository.AddAsync(message);
        return Result<MessageDto>.Success(messageDto);
    }
}

// Controller
[HttpPost("{chatId}/messages")]
public async Task<IActionResult> SendMessage(Guid chatId, SendMessageDto dto)
{
    var command = new SendMessageCommand(chatId, dto.Content, userId);
    var result = await _mediator.Send(command);
    return result.IsSuccess ? Ok(result.Data) : BadRequest(result.Error);
}
```

### Query (читает данные)

```csharp
// Query
public record GetMessagesQuery(Guid ChatId) : IRequest<Result<List<MessageDto>>>;

// Handler
public class GetMessagesQueryHandler : IRequestHandler<GetMessagesQuery, Result<List<MessageDto>>>
{
    public async Task<Result<List<MessageDto>>> Handle(...)
    {
        var messages = await _messageRepository.GetByChatIdAsync(query.ChatId);
        return Result<List<MessageDto>>.Success(messageDtos);
    }
}
```

## База данных

### Миграции

```bash
# Создать
dotnet ef migrations add MigrationName --project ../WhithinMessenger.Infrastructure

# Применить
dotnet ef database update --project ../WhithinMessenger.Infrastructure

# Откатить
dotnet ef database update PreviousMigration --project ../WhithinMessenger.Infrastructure

# Удалить последнюю
dotnet ef migrations remove --project ../WhithinMessenger.Infrastructure
```

### Основные таблицы

- `ApplicationUsers` - Пользователи
- `UserProfiles` - Профили
- `Chats` - Чаты
- `Messages` - Сообщения
- `Servers` - Серверы
- `ChatCategories` - Категории
- `ServerMembers` - Участники
- `ServerRoles` - Роли
- `Friendships` - Друзья
- `Notifications` - Уведомления

## Разработка

### Добавление новой функции

1. Создать Command/Query в `Application/CommandsAndQueries`
2. Создать Handler
3. Добавить Validator (если нужно)
4. Добавить endpoint в Controller
5. Обновить SignalR hub (если нужно)

### Пример структуры

```
CommandsAndQueries/
└── Messages/
    └── SendMessage/
        ├── SendMessageCommand.cs
        ├── SendMessageCommandHandler.cs
        └── SendMessageCommandValidator.cs
```

## Docker

```bash
# Запустить
docker-compose up -d

# Применить миграции
docker-compose exec whithinmessenger.api dotnet ef database update
```

## Production

```bash
dotnet publish -c Release -o ./publish
```

---

