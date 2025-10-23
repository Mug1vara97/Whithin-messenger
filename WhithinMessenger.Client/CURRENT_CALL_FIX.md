# ✅ Исправление currentCall = undefined - ЗАВЕРШЕНО

## 🔧 **Проблема:**
```
VoiceCallView: Current call state: {isConnected: true, currentCall: undefined}
VoiceCallView: Starting voice call
```

`currentCall` оставался `undefined` даже при активном звонке, поэтому проверка не работала.

## 🛠️ **Исправления:**

### 1. **Добавлен `currentCall` в Zustand store**
```javascript
// В callStore.js
currentCall: null,
```

### 2. **Обновление `currentCall` при создании звонка**
```javascript
// В joinRoom
set({ 
  currentRoomId: roomId, 
  isInCall: true, 
  currentCall: { channelId: roomId, channelName: roomId } 
});
```

### 3. **Очистка `currentCall` при завершении звонка**
```javascript
// В endCall
set({
  // ... другие поля
  currentCall: null,
  // ...
});
```

### 4. **Добавлен `currentCall` в CallContext**
```javascript
// В CallContext.jsx
currentCall: callStore.currentCall,
```

## 🎯 **Ожидаемый результат:**

Теперь в логах должно быть:
```
VoiceCallView: Current call state: {isConnected: true, currentCall: {channelId: "5d408547-0d2d-48a0-9873-7dcee8f30dd6", channelName: "5d408547-0d2d-48a0-9873-7dcee8f30dd6"}}
VoiceCallView: Call already active in this channel, skipping start
```

## 📋 **Логика работы:**

1. **Создание звонка** → `currentCall` обновляется в Zustand store
2. **Переключение каналов** → `currentCall` сохраняется в store
3. **Возврат к голосовому каналу** → Проверяется `currentCall.channelId === channelId`
4. **Если совпадает** → Пропускается создание нового звонка
5. **Если не совпадает** → Создается новый звонок

## ✅ **Статус:** ГОТОВО К ТЕСТИРОВАНИЮ


