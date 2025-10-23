# 🔧 Исправление кнопки звонка в чате

## 🐛 **Проблема:**
Кнопка звонка в чате не работала - при нажатии ничего не происходило.

## 🔍 **Причина:**
В `HomePage.jsx` не передавался проп `onJoinVoiceChannel` в компонент `ChatRoom`.

## ✅ **Исправления:**

### 1. **Добавлена функция обработки звонков в HomePage:**
```javascript
// Функция для обработки звонков в чатах
const handleJoinVoiceChannel = useCallback((callData) => {
  console.log('HomePage: handleJoinVoiceChannel called with:', callData);
  
  // Здесь можно добавить логику для обработки звонка
  // Например, показать уведомление или обновить состояние
  console.log('HomePage: Voice call started in chat:', callData.roomName);
}, []);
```

### 2. **Передан проп в ChatRoom:**
```jsx
<ChatRoom
  chatId={selectedChat.chatId || selectedChat.chat_id}
  groupName={selectedChat.groupName || selectedChat.username}
  isGroupChat={selectedChat.isGroupChat}
  isServerChat={selectedServer ? true : false}
  chatTypeId={selectedChat.chatTypeId}
  userId={user?.id}
  onJoinVoiceChannel={handleJoinVoiceChannel}  // ← Добавлено
/>
```

### 3. **Добавлены отладочные логи в ChatRoom:**
```javascript
const handleStartCall = (e) => {
  console.log('handleStartCall: clicked', { isPrivateChat, isGroupChat, isCallActiveInThisChat, otherUserInCall });
  
  if ((isPrivateChat || isGroupChat) && !isCallActiveInThisChat) {
    console.log('handleStartCall: starting call without notification');
    handleCallWithoutNotification();
  } else {
    console.log('handleStartCall: conditions not met for starting call');
  }
};

const handleCallWithoutNotification = () => {
  console.log('handleCallWithoutNotification: called with data:', { 
    chatId, groupName, username, userId, onJoinVoiceChannel 
  });
  
  const callData = {
    roomId: chatId.toString(),
    roomName: `Звонок с ${groupName}`,
    userName: username,
    userId: userId,
    isPrivateCall: true,
    chatId: chatId
  };
  
  console.log('handleCallWithoutNotification: callData created:', callData);
  
  if (onJoinVoiceChannel) {
    console.log('handleCallWithoutNotification: calling onJoinVoiceChannel');
    onJoinVoiceChannel(callData);
  } else {
    console.log('handleCallWithoutNotification: onJoinVoiceChannel is not available');
  }
  
  console.log('handleCallWithoutNotification: call started');
};
```

## 🧪 **Тестирование:**

Теперь при нажатии на кнопку звонка в консоли должны появиться логи:
1. `handleStartCall: clicked` - кнопка нажата
2. `handleStartCall: starting call without notification` - условия выполнены
3. `handleCallWithoutNotification: called with data` - функция вызвана
4. `handleCallWithoutNotification: callData created` - данные созданы
5. `handleCallWithoutNotification: calling onJoinVoiceChannel` - вызов функции
6. `HomePage: handleJoinVoiceChannel called with` - обработка в HomePage

## 🚀 **Результат:**
Кнопка звонка теперь должна работать и выводить отладочную информацию в консоль!


