# Исправления аутентификации пользователя

## Проблема:
В логах видно: `useGlobalCall: startCall called with user: null` - пользователь не передается в useGlobalCall.

## Причина:
В VoiceCallView мы передаем `user?.id` и `user?.username`, но в логах видно, что пользователь имеет `id: '019a0a78-ace4-7b7f-97fe-3bb15b740ec0'`. Проблема в том, что поля пользователя могут называться по-разному.

## Исправления:

### 1. HomePage.jsx - добавлены fallback поля
```javascript
// Было:
userId={user?.id}
userName={user?.username}

// Стало:
userId={user?.id || user?.userId}
userName={user?.username || user?.name}
```

### 2. VoiceCallView.jsx - добавлена отладочная информация
```javascript
console.log('VoiceCallView: useEffect triggered with:', { channelId, userId, userName, channelName });
```

### 3. HomePage.jsx - добавлена отладочная информация
```javascript
console.log('HomePage: Rendering VoiceCallView with user:', user, 'selectedChat:', selectedChat);
```

## Результат:

Теперь система должна:
- ✅ Правильно передавать пользователя в VoiceCallView
- ✅ Использовать fallback поля для совместимости
- ✅ Показывать отладочную информацию для диагностики

## Следующие шаги:

1. Проверить, что пользователь корректно передается в VoiceCallView
2. Убедиться, что startCall получает правильные параметры
3. Проверить работу глобальной системы звонков
