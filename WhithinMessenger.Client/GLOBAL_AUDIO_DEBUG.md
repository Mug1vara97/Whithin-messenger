# 🔍 Отладка синхронизации глобального звука

## 📊 **Анализ логов:**

### ✅ **Что работает:**
- Звонки инициируются и подключаются
- Участники видят друг друга
- Шумоподавление работает
- Глобальный звук отправляется на сервер

### 🔍 **Проблема:**
```
Первый пользователь отправляет:
Sending audioState to server: {isEnabled: false, isGlobalAudioMuted: true, userId: '...'}

Второй пользователь получает:
peerAudioStateChanged received: {peerId: '...', userId: '...', isAudioEnabled: false, isGlobalAudioMuted: undefined}
```

**Проблема:** Сервер не передает `isGlobalAudioMuted` в событии `peerAudioStateChanged`

## 🔧 **Добавлена отладка:**

### **В callStore.js:**
1. **Отправка на сервер:**
   ```javascript
   console.log('Sending audioState to server:', audioStateData);
   ```

2. **Получение от сервера:**
   ```javascript
   console.log('peerAudioStateChanged received:', { peerId, userId, isAudioEnabled, isGlobalAudioMuted });
   console.log('Full data received:', data);
   ```

3. **Обработка статуса:**
   ```javascript
   if (isGlobalAudioMuted !== undefined) {
     updated.isGlobalAudioMuted = isGlobalAudioMuted;
     console.log('Updated participant with global audio state:', updated);
   } else {
     console.log('isGlobalAudioMuted is undefined, not updating global audio state');
   }
   ```

## 🧪 **Тестирование:**

### **Шаги:**
1. Запустите два браузера
2. Начните звонок 1 на 1
3. Нажмите кнопку глобального звука
4. Проверьте логи в консоли

### **Ожидаемые логи:**
```
Sending audioState to server: {isEnabled: false, isGlobalAudioMuted: true, userId: '...'}
peerAudioStateChanged received: {peerId: '...', userId: '...', isAudioEnabled: false, isGlobalAudioMuted: true}
Updated participant with global audio state: {...}
```

### **Если проблема:**
```
peerAudioStateChanged received: {peerId: '...', userId: '...', isAudioEnabled: false, isGlobalAudioMuted: undefined}
isGlobalAudioMuted is undefined, not updating global audio state
```

**Это означает, что сервер не передает `isGlobalAudioMuted` в событии `peerAudioStateChanged`**

## 🎯 **Следующие шаги:**

1. **Если сервер передает `isGlobalAudioMuted`** - проблема в обработке
2. **Если сервер НЕ передает `isGlobalAudioMuted`** - нужно исправить серверную часть

Попробуйте протестировать и посмотрите, что показывают логи! 🔍


