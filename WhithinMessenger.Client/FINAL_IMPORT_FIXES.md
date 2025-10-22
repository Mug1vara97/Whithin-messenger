# Финальные исправления импортов

## Исправленные проблемы:

### 1. GlobalCallManager экспорт
**Проблема:** `export * from './GlobalCallManager'` не работает для default exports
**Решение:** `export { default as GlobalCallManager } from './GlobalCallManager'`

### 2. ActiveCallBar экспорт  
**Проблема:** `export * from './ActiveCallBar'` не работает для default exports
**Решение:** `export { default as ActiveCallBar } from './ActiveCallBar'`

### 3. CallButton экспорт
**Проблема:** `export * from './CallButton'` не работает для default exports  
**Решение:** `export { default as CallButton } from './CallButton'`

### 4. createParticipant путь
**Проблема:** Неправильный относительный путь
**Решение:** Исправлен путь с `../../../` на `../../../../`

## Обновленные файлы:

1. **src/shared/ui/organisms/index.js** - добавлен правильный экспорт GlobalCallManager
2. **src/shared/ui/molecules/index.js** - добавлены правильные экспорты для default компонентов
3. **src/shared/ui/molecules/ActiveCallBar/ActiveCallBar.jsx** - исправлен путь к createParticipant
4. **src/shared/ui/molecules/VoiceChannelSelector/VoiceChannelSelector.jsx** - исправлен импорт CallButton

## Результат:

Теперь все компоненты системы звонков должны работать корректно:

✅ **App.jsx** - импортирует GlobalCallManager
✅ **GlobalCallManager** - импортирует ActiveCallBar  
✅ **ActiveCallBar** - импортирует createParticipant
✅ **CallButton** - экспортируется как default
✅ **VoiceChannelSelector** - импортирует CallButton

## Архитектура системы:

```
App.jsx
├── AppProviders (CallProvider)
├── AppRouter (страницы)
└── GlobalCallManager
    └── ActiveCallBar (глобальная панель)
```

Все импорты теперь должны работать без ошибок! 🎉
