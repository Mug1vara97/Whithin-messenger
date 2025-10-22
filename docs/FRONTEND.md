# Frontend - WhithinMessenger

React 19 приложение с Feature-Sliced Design архитектурой.

## Архитектура

**Feature-Sliced Design:**
```
app → pages → widgets → entities → shared
```

**Atomic Design (в shared/ui):**
```
atoms → molecules → organisms
```

## Структура проекта

```
src/
├── app/                    # Инициализация
│   ├── providers/          # Context providers
│   └── router/             # React Router
│
├── pages/                  # Страницы
│   ├── home/
│   ├── login/
│   ├── friends/
│   └── server/
│
├── widgets/                # Композитные блоки
│   ├── chat-list/
│   ├── chat-room/
│   ├── server-list/
│   └── ...
│
├── entities/               # Бизнес-сущности
│   ├── chat/
│   │   ├── api/            # API методы
│   │   ├── hooks/          # useChat, useChatList
│   │   └── model/          # Types
│   ├── message/
│   ├── server/
│   └── user/
│
└── shared/                 # Общий код
    ├── ui/                 # UI компоненты
    │   ├── atoms/          # Button, Input, Avatar
    │   ├── molecules/      # MessageItem, SearchBar
    │   └── organisms/      # LoginForm, ChatList
    ├── lib/
    │   ├── api/            # API client
    │   ├── contexts/       # React Contexts
    │   ├── hooks/          # Custom hooks
    │   └── utils/
    └── constants/
```

## Технологии

- React 19 + Vite
- SignalR Client (WebSockets)
- Material-UI
- React Router v7
- Axios
- WaveSurfer.js (аудио)
- @dnd-kit (drag & drop)

## Быстрый старт

```bash
npm install
npm run dev  # http://localhost:5173

# Production build
npm run build  # → dist/

# Lint
npm run lint
```

## Компоненты

### Atoms (базовые)

```jsx
import { Button } from '@/shared/ui/atoms';

<Button onClick={handleClick} variant="primary">
  Отправить
</Button>
```

### Molecules (композитные)

```jsx
import { MessageItem } from '@/shared/ui/molecules';

<MessageItem
  message={message}
  onEdit={handleEdit}
  onDelete={handleDelete}
/>
```

### Widgets (бизнес-блоки)

```jsx
import { ChatRoom } from '@/widgets/chat-room';

<ChatRoom chatId={chatId} />
```

## State Management

### Contexts

```jsx
// Использование
import { useAuth } from '@/shared/lib/hooks';

const { user, login, logout, isAuthenticated } = useAuth();
```

**Доступные contexts:**
- `AuthContext` - аутентификация
- `ConnectionContext` - SignalR соединения
- `ServerContext` - текущий сервер

### Custom Hooks

```jsx
// Работа с чатом
import { useChatRoom } from '@/shared/lib/hooks';

const {
  messages,
  sendMessage,
  editMessage,
  deleteMessage
} = useChatRoom(chatId);
```

**Основные hooks:**
- `useAuth` - аутентификация
- `useChat` - чат
- `useChatRoom` - комната чата с SignalR
- `useDebounce` - debounce значений
- `useContextMenu` - контекстное меню

## API Integration

### API Client

```javascript
// entities/chat/api/chatApi.js
import apiClient from '@/shared/lib/api/apiClient';

export const chatApi = {
  getChatList: () => apiClient.get('/chats'),
  getMessages: (chatId) => apiClient.get(`/chats/${chatId}/messages`),
  sendMessage: (chatId, data) => apiClient.post(`/chats/${chatId}/messages`, data)
};
```

### Entity Hooks

```javascript
// entities/chat/hooks/useChatList.js
export const useChatList = () => {
  const [chats, setChats] = useState([]);
  
  useEffect(() => {
    const fetchChats = async () => {
      const { data } = await chatApi.getChatList();
      setChats(data);
    };
    fetchChats();
  }, []);
  
  return { chats };
};
```

## SignalR Integration

### Подключение

```javascript
import { HubConnectionBuilder } from '@microsoft/signalr';

const connection = new HubConnectionBuilder()
  .withUrl('/groupchathub')
  .withAutomaticReconnect()
  .build();

await connection.start();

// Слушать события
connection.on('ReceiveMessage', (message) => {
  // Обновить UI
});

// Вызвать метод сервера
await connection.invoke('SendMessage', chatId, content);
```

### В компоненте

```jsx
function ChatRoom({ chatId }) {
  const { messages, sendMessage } = useChatRoom(chatId);
  
  return (
    <div>
      {messages.map(msg => <MessageItem key={msg.id} message={msg} />)}
      <MessageInput onSend={sendMessage} />
    </div>
  );
}
```

## Стилизация

### CSS Modules

```jsx
import styles from './Component.css';

<div className={styles.container}>
  <h1 className={styles.title}>Title</h1>
</div>
```

### CSS переменные

```css
:root {
  --bg-primary: #1a1a1d;
  --text-primary: #ffffff;
  --accent: #5865f2;
}
```

## Конфигурация

### vite.config.js

```javascript
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:5117',
        changeOrigin: true
      }
    }
  }
});
```

## Разработка

### Feature-Sliced Design правила

```javascript
// ✅ Можно импортировать вниз по слоям
import { Button } from '@/shared/ui/atoms';
import { useAuth } from '@/shared/lib/hooks';

// ❌ Нельзя импортировать между слайсами
import { ChatList } from '@/widgets/chat-list'; // в другом виджете
```

### Добавление компонента

```
ComponentName/
├── ComponentName.jsx       # Компонент
├── ComponentName.css       # Стили
└── index.js                # Export
```

```jsx
// ComponentName.jsx
import styles from './ComponentName.css';

export const ComponentName = ({ prop }) => {
  return <div className={styles.container}>...</div>;
};
```

```js
// index.js
export { ComponentName } from './ComponentName';
```

## Production

```bash
npm run build  # → dist/
npm run preview  # preview production build
```

---

**Рекомендации:**
- Используйте Feature-Sliced Design
- Следуйте Atomic Design для UI
- Выносите логику в custom hooks
- Используйте CSS Modules











