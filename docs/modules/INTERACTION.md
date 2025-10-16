# Взаимодействие модулей

Описание того, как модули Backend и Frontend взаимодействуют друг с другом.

## Backend: Command/Query Flow

```mermaid
sequenceDiagram
    participant C as Controller
    participant M as MediatR
    participant H as Handler
    participant R as Repository
    participant DB as Database
    
    C->>M: Send(Command/Query)
    M->>H: Handle(Command/Query)
    H->>R: Execute operation
    R->>DB: SQL query
    DB->>R: Result
    R->>H: Domain model
    H->>M: Result DTO
    M->>C: Result DTO
```

### Пример: Отправка сообщения

**1. Controller получает запрос**:
```csharp
[HttpPost]
public async Task<IActionResult> SendMessage([FromBody] SendMessageRequest request) {
    var command = new SendMessageCommand {
        ChatId = request.ChatId,
        SenderId = GetCurrentUserId(),
        Content = request.Content
    };
    
    var result = await _mediator.Send(command);
    return Ok(result);
}
```

**2. MediatR передаёт Handler**:
```csharp
public class SendMessageCommandHandler : IRequestHandler<SendMessageCommand, MessageDto> {
    private readonly IMessageRepository _messageRepo;
    
    public async Task<MessageDto> Handle(SendMessageCommand request, CancellationToken ct) {
        var message = new Message {
            ChatId = request.ChatId,
            SenderId = request.SenderId,
            Content = request.Content,
            Timestamp = DateTime.UtcNow
        };
        
        await _messageRepo.AddAsync(message);
        
        return MapToDto(message);
    }
}
```

**3. Repository выполняет операцию**:
```csharp
public class MessageRepository : IMessageRepository {
    private readonly MessengerContext _context;
    
    public async Task AddAsync(Message message) {
        _context.Messages.Add(message);
        await _context.SaveChangesAsync();
    }
}
```

---

## Frontend: User Action Flow

```mermaid
sequenceDiagram
    participant U as User
    participant W as Widget
    participant E as Entity API
    participant H as Hook
    participant B as Backend
    
    U->>W: Действие (клик, ввод)
    W->>E: Вызов API метода
    E->>H: Использует hook
    H->>B: HTTP/SignalR запрос
    B->>H: Response
    H->>E: Обновление состояния
    E->>W: Ре-рендер
    W->>U: Обновлённый UI
```

### Пример: Отправка сообщения

**1. Widget (ChatRoom)**:
```jsx
export const ChatRoom = ({ chatId }) => {
  const { sendMessage } = useChatRoom(chatId);
  
  const handleSend = (content) => {
    sendMessage(content);
  };
  
  return <MessageInput onSend={handleSend} />;
};
```

**2. Hook (useChatRoom)**:
```javascript
export const useChatRoom = (chatId) => {
  const { connection } = useConnection();
  const [messages, setMessages] = useState([]);
  
  const sendMessage = async (content) => {
    await connection.invoke('SendMessage', chatId, content);
  };
  
  useEffect(() => {
    connection.on('ReceiveMessage', (message) => {
      setMessages(prev => [...prev, message]);
    });
  }, [connection]);
  
  return { messages, sendMessage };
};
```

**3. Entity API (messageApi)**:
```javascript
export const messageApi = {
  sendMessage: async (chatId, content, mediaFiles, replyToId) => {
    return apiClient.post('/messages', {
      chatId,
      content,
      mediaFileIds: mediaFiles?.map(f => f.id) || [],
      replyToMessageId: replyToId
    });
  }
};
```

---

## HTTP + SignalR взаимодействие

### Отправка сообщения

```mermaid
sequenceDiagram
    participant UI as ChatRoom Widget
    participant API as message/api
    participant Hub as SignalR Hub
    participant CMD as SendMessageCommand
    participant DB as Database
    participant U2 as Other Users
    
    UI->>API: sendMessage(chatId, content)
    API->>Hub: SendMessage (SignalR)
    Hub->>CMD: Execute command
    CMD->>DB: Insert message
    DB->>CMD: Message saved
    CMD->>Hub: MessageDto
    Hub->>API: MessageSent event
    API->>UI: Update local state
    
    Note over Hub: Broadcast to other users
    Hub->>U2: ReceiveMessage event
```

### Создание чата

```mermaid
sequenceDiagram
    participant UI as Widget
    participant API as chatApi
    participant BE as Backend API
    participant Hub as SignalR
    participant P as Participants
    
    UI->>API: createGroupChat(name, userIds)
    API->>BE: POST /api/chats/group
    BE->>BE: Create chat in DB
    BE->>Hub: Notify participants
    Hub->>P: ChatCreated event
    BE->>API: ChatDto
    API->>UI: Update UI
```

---

## Примеры интеграции модулей

### 1. Добавление друга → Создание чата

```mermaid
sequenceDiagram
    participant U as User
    participant F as Friends Widget
    participant FA as friendApi
    participant CA as chatApi
    participant BE as Backend
    
    U->>F: Click "Добавить в друзья"
    F->>FA: sendFriendRequest(userId)
    FA->>BE: POST /api/friends/request
    BE->>BE: Create friend request
    
    Note over BE: Другой пользователь принимает
    
    BE->>FA: FriendRequestAccepted (SignalR)
    FA->>F: Update friends list
    
    U->>F: Click "Написать"
    F->>CA: createPrivateChat(friendId)
    CA->>BE: POST /api/chats/private
    BE->>CA: ChatDto
    CA->>F: Navigate to chat
```

### 2. Присоединение к серверу → Загрузка каналов

```mermaid
sequenceDiagram
    participant U as User
    participant SD as ServerDiscovery
    participant SA as serverApi
    participant BE as Backend
    participant SP as ServerPanel
    
    U->>SD: Search server
    SD->>SA: getPublicServers(query)
    SA->>BE: GET /api/servers/public
    BE->>SA: Server[]
    SA->>SD: Display results
    
    U->>SD: Click "Присоединиться"
    SD->>SA: joinServer(serverId)
    SA->>BE: POST /api/servers/{id}/join
    BE->>BE: Add user to server
    BE->>SA: Success
    
    SA->>SP: Navigate to server
    SP->>SA: getServerInfo(serverId)
    SA->>BE: GET /api/servers/{id}
    BE->>SA: ServerDetail (categories, channels)
    SA->>SP: Display channels
```

### 3. Загрузка медиа → Отправка сообщения

```mermaid
sequenceDiagram
    participant U as User
    participant CR as ChatRoom
    participant MA as mediaApi
    participant MSG as messageApi
    participant BE as Backend
    
    U->>CR: Select files
    CR->>MA: uploadMedia(files)
    MA->>BE: POST /api/media/upload (multipart)
    BE->>BE: Save files
    BE->>MA: MediaFileDto[]
    MA->>CR: Files uploaded
    
    U->>CR: Click "Отправить"
    CR->>MSG: sendMessage(chatId, content, mediaFiles)
    MSG->>BE: SignalR SendMessage
    BE->>BE: Create message with media
    BE->>MSG: MessageDto (with media)
    MSG->>CR: Display message with attachments
```

---

## Управление состоянием

### Frontend State Flow

```mermaid
graph TB
    User[User Action]
    Widget[Widget Component]
    Hook[Custom Hook]
    State[React State]
    API[Entity API]
    Backend[Backend API]
    SignalR[SignalR Hub]
    
    User --> Widget
    Widget --> Hook
    Hook --> State
    Hook --> API
    API --> Backend
    Backend --> API
    API --> State
    State --> Widget
    
    SignalR --> Hook
    Hook --> SignalR
```

### Backend Data Flow

```mermaid
graph TB
    Request[HTTP Request]
    Controller[Controller]
    Mediator[MediatR]
    Handler[Command/Query Handler]
    Repo[Repository]
    DB[(Database)]
    Hub[SignalR Hub]
    
    Request --> Controller
    Controller --> Mediator
    Mediator --> Handler
    Handler --> Repo
    Repo --> DB
    DB --> Repo
    Repo --> Handler
    Handler --> Mediator
    Mediator --> Controller
    
    Handler --> Hub
    Hub --> Hub[Broadcast to clients]
```

---

## Real-time обновления через SignalR

### Backend Hubs

**GroupChatHub**:
```csharp
public class GroupChatHub : Hub {
    public async Task SendMessage(Guid chatId, string content) {
        var command = new SendMessageCommand { ... };
        var message = await _mediator.Send(command);
        
        // Broadcast всем участникам чата
        await Clients.Group(chatId.ToString())
            .SendAsync("ReceiveMessage", message);
    }
    
    public async Task JoinChat(Guid chatId) {
        await Groups.AddToGroupAsync(Context.ConnectionId, chatId.ToString());
    }
}
```

**ServerHub**:
```csharp
public class ServerHub : Hub {
    public async Task JoinServer(Guid serverId) {
        await Groups.AddToGroupAsync(Context.ConnectionId, $"server_{serverId}");
    }
    
    public async Task NotifyMemberJoined(Guid serverId, Guid userId) {
        await Clients.Group($"server_{serverId}")
            .SendAsync("MemberJoined", userId);
    }
}
```

### Frontend Connections

```javascript
// ConnectionContext.jsx
const connection = new signalR.HubConnectionBuilder()
  .withUrl('https://localhost:5117/groupchathub')
  .withAutomaticReconnect()
  .build();

// Подписка на события
connection.on('ReceiveMessage', (message) => {
  // Обновить UI
});

connection.on('UserJoined', (user) => {
  // Обновить список участников
});
```

---

## Error Handling

### Backend

```csharp
public class GlobalExceptionMiddleware {
    public async Task InvokeAsync(HttpContext context, RequestDelegate next) {
        try {
            await next(context);
        }
        catch (NotFoundException ex) {
            context.Response.StatusCode = 404;
            await context.Response.WriteAsJsonAsync(new { error = ex.Message });
        }
        catch (ValidationException ex) {
            context.Response.StatusCode = 400;
            await context.Response.WriteAsJsonAsync(new { errors = ex.Errors });
        }
        catch (Exception ex) {
            context.Response.StatusCode = 500;
            await context.Response.WriteAsJsonAsync(new { error = "Internal server error" });
        }
    }
}
```

### Frontend

```javascript
// apiClient.js
apiClient.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response?.status === 404) {
      // Show not found message
      toast.error('Ресурс не найден');
    }
    else if (error.response?.status === 400) {
      // Validation error
      toast.error('Ошибка валидации');
    }
    else {
      // Show generic error
      toast.error('Произошла ошибка');
    }
    return Promise.reject(error);
  }
);
```

---

[← Назад к модулям](README.md)

