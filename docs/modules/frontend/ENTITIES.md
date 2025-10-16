# Frontend Entities

**Слой**: Entities (бизнес-сущности)

**Назначение**: Работа с бизнес-логикой и данными

**Расположение**: `WhithinMessenger.Client/src/entities/`

## Структура Entity

Каждая entity следует единому шаблону:

```
entity-name/
├── api/
│   ├── entityApi.js    # HTTP запросы
│   └── index.js
├── model/
│   ├── types.js        # Константы и типы
│   └── index.js
├── hooks/
│   ├── useEntity.js    # React hooks
│   └── index.js
└── index.js            # Публичный API
```

## 1. chat

**Назначение**: Управление чатами

### API методы (`api/chatApi.js`)

```javascript
// Получение всех чатов пользователя
getUserChats(): Promise<Chat[]>

// Создание приватного чата
createPrivateChat(userId: string): Promise<Chat>

// Создание группового чата
createGroupChat(name: string, userIds: string[]): Promise<Chat>

// Информация о чате
getChatInfo(chatId: string): Promise<ChatInfo>

// Участники чата
getChatParticipants(chatId: string): Promise<Participant[]>

// Обновление аватара
updateChatAvatar(chatId: string, file: File): Promise<void>

// Удаление чата
deleteChat(chatId: string): Promise<void>
```

### Types (`model/types.js`)

```javascript
export const CHAT_TYPES = {
  PRIVATE: 1,    // Приватный чат
  GROUP: 2,      // Групповой чат
  SERVER: 3      // Канал сервера
};

export const CHAT_STATUS = {
  ACTIVE: 'active',
  DELETED: 'deleted'
};

export const MESSAGE_TYPES = {
  TEXT: 'text',
  IMAGE: 'image',
  VIDEO: 'video',
  AUDIO: 'audio',
  FILE: 'file',
  VOICE: 'voice'
};
```

### Hooks (`hooks/useChatList.js`)

```javascript
export const useChatList = () => {
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    loadChats();
  }, []);
  
  const loadChats = async () => {
    const data = await chatApi.getUserChats();
    setChats(data);
  };
  
  return { chats, loading, refresh: loadChats };
};
```

---

## 2. friend

**Назначение**: Система друзей

### API методы (`api/friendApi.js`)

```javascript
// Получение друзей
getFriends(): Promise<Friend[]>

// Получение заявок в друзья
getFriendRequests(): Promise<FriendRequest[]>

// Отправка заявки
sendFriendRequest(userId: string): Promise<void>

// Принятие заявки
acceptFriendRequest(requestId: string): Promise<void>

// Отклонение заявки
declineFriendRequest(requestId: string): Promise<void>

// Удаление из друзей
removeFriend(friendId: string): Promise<void>
```

### Types (`model/types.js`)

```javascript
export const FRIEND_STATUS = {
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  DECLINED: 'declined'
};
```

### Hooks

**`useFriends()`**:
```javascript
export const useFriends = () => {
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const removeFriend = async (friendId) => {
    await friendApi.removeFriend(friendId);
    setFriends(prev => prev.filter(f => f.id !== friendId));
  };
  
  return { friends, loading, removeFriend };
};
```

**`useFriendRequests()`**:
```javascript
export const useFriendRequests = () => {
  const [requests, setRequests] = useState([]);
  
  const accept = async (requestId) => {
    await friendApi.acceptFriendRequest(requestId);
    // Обновить список
  };
  
  const decline = async (requestId) => {
    await friendApi.declineFriendRequest(requestId);
    // Обновить список
  };
  
  return { requests, accept, decline };
};
```

---

## 3. message

**Назначение**: Работа с сообщениями

### API методы (`api/messageApi.js`)

```javascript
// Получение сообщений чата
getMessages(chatId: string, page: number, pageSize: number): Promise<MessagesResponse>

// Отправка сообщения
sendMessage(chatId: string, content: string, mediaFiles: File[], replyToId?: string): Promise<Message>

// Редактирование сообщения
editMessage(messageId: string, newContent: string): Promise<Message>

// Удаление сообщения
deleteMessage(messageId: string): Promise<void>

// Поиск по сообщениям
searchMessages(chatId: string, searchTerm: string): Promise<Message[]>
```

### Types (`model/types.js`)

```javascript
export const MESSAGE_STATUS = {
  SENDING: 'sending',
  SENT: 'sent',
  FAILED: 'failed'
};
```

---

## 4. server

**Назначение**: Управление серверами

### API методы (`api/serverApi.js`)

```javascript
// Серверы пользователя
getUserServers(): Promise<Server[]>

// Публичные серверы
getPublicServers(searchTerm?: string, page?: number): Promise<ServersResponse>

// Создание сервера
createServer(name: string, isPublic: boolean, description?: string): Promise<Server>

// Присоединение к серверу
joinServer(serverId: string): Promise<void>

// Покидание сервера
leaveServer(serverId: string): Promise<void>

// Удаление сервера
deleteServer(serverId: string): Promise<void>

// Информация о сервере
getServerInfo(serverId: string): Promise<ServerDetail>

// Создание категории
createCategory(serverId: string, name: string): Promise<Category>

// Создание канала
createChannel(serverId: string, categoryId: string, name: string, type: number): Promise<Channel>
```

### Hooks

**`useServers()`**:
```javascript
export const useServers = () => {
  const [servers, setServers] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const createServer = async (name, isPublic) => {
    const server = await serverApi.createServer(name, isPublic);
    setServers(prev => [...prev, server]);
    return server;
  };
  
  return { servers, loading, createServer };
};
```

**`useServer(serverId)`**:
```javascript
export const useServer = (serverId) => {
  const [server, setServer] = useState(null);
  const [categories, setCategories] = useState([]);
  
  const createChannel = async (categoryId, name, type) => {
    const channel = await serverApi.createChannel(serverId, categoryId, name, type);
    // Обновить категории
  };
  
  return { server, categories, createChannel };
};
```

---

## 5. member

**Назначение**: Участники сервера

### API методы (`api/memberApi.js`)

```javascript
// Получение участников сервера
getServerMembers(serverId: string): Promise<Member[]>

// Добавление участника
addMember(serverId: string, userId: string): Promise<void>

// Удаление участника
removeMember(serverId: string, userId: string): Promise<void>
```

### Hooks (`hooks/useMembers.js`)

```javascript
export const useMembers = (serverId) => {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const addMember = async (userId) => {
    await memberApi.addMember(serverId, userId);
    // Обновить список
  };
  
  const removeMember = async (userId) => {
    await memberApi.removeMember(serverId, userId);
    setMembers(prev => prev.filter(m => m.userId !== userId));
  };
  
  return { members, loading, addMember, removeMember };
};
```

---

## 6. user

**Назначение**: Профили пользователей

### API методы (`api/userApi.js`)

```javascript
// Поиск пользователей
searchUsers(query: string): Promise<User[]>

// Получение профиля
getUserProfile(userId: string): Promise<UserProfile>

// Обновление профиля
updateProfile(profileData: ProfileData): Promise<UserProfile>

// Получение текущего пользователя
getCurrentUser(): Promise<User>
```

---

## Общие паттерны

### 1. API Client

Все entity используют общий `apiClient`:

```javascript
import { apiClient } from '@/shared/lib/api';

export const chatApi = {
  getUserChats: () => apiClient.get('/api/chats'),
  createPrivateChat: (userId) => apiClient.post('/api/chats/private', { userId }),
  // ...
};
```

### 2. Error Handling

```javascript
try {
  const chats = await chatApi.getUserChats();
  setChats(chats);
} catch (error) {
  console.error('Error loading chats:', error);
  // Показать уведомление об ошибке
}
```

### 3. SignalR Integration

Многие entities подписываются на SignalR события:

```javascript
useEffect(() => {
  connection.on('ReceiveMessage', (message) => {
    setMessages(prev => [...prev, message]);
  });
  
  return () => {
    connection.off('ReceiveMessage');
  };
}, [connection]);
```

---

## Использование в компонентах

```javascript
// В Widget или Page
import { chatApi } from '@/entities/chat';
import { useChatList } from '@/entities/chat';

function ChatList() {
  const { chats, loading } = useChatList();
  
  if (loading) return <Spinner />;
  
  return (
    <div>
      {chats.map(chat => <ChatItem key={chat.id} chat={chat} />)}
    </div>
  );
}
```

---

[← Назад к модулям](../README.md) | [Frontend модули](./README.md)

