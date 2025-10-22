# Исправления runtime ошибок

## Проблемы, которые были исправлены:

### 1. `t.setState is not a function`
**Проблема:** Неправильное использование Zustand store API
**Решение:** Заменили `callStore.setState` на `useCallStore.setState`

### 2. `User not authenticated`
**Проблема:** Неправильные поля пользователя в useGlobalCall
**Решение:** Добавили fallback для `user.id || user.userId` и `user.username || user.name`

### 3. `Failed to parse noise suppression setting`
**Проблема:** Неправильное обновление состояния в CallContext
**Решение:** Использовали правильный API Zustand store

## Исправленные файлы:

### 1. CallContext.jsx
```javascript
// Было:
callStore.setState({ isNoiseSuppressed: true });

// Стало:
useCallStore.setState({ isNoiseSuppressed: true });
```

### 2. useGlobalCall.js
```javascript
// Было:
await callContext.initializeCall(user.id, user.name);

// Стало:
await callContext.initializeCall(user.id || user.userId, user.username || user.name);
```

### 3. Добавлена отладка
```javascript
console.log('useGlobalCall: startCall called with user:', user);
```

## Результат:

Теперь система должна работать без runtime ошибок:
- ✅ Zustand store обновляется корректно
- ✅ Аутентификация работает с правильными полями пользователя
- ✅ Шумоподавление инициализируется без ошибок
- ✅ Добавлена отладочная информация для диагностики

## Следующие шаги:

1. Проверить, что пользователь корректно передается в useGlobalCall
2. Убедиться, что звонок инициализируется без ошибок
3. Проверить работу глобальной панели звонка
