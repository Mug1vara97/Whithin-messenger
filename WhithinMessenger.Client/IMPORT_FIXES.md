# Исправления импортов

## Проблемы, которые были исправлены:

### 1. Неправильный путь к createParticipant
**Было:** `../../../entities/video-call/model/types`
**Стало:** `../../../../entities/video-call/model/types`

### 2. Неправильный импорт CallButton
**Было:** `import { CallButton } from '../CallButton';`
**Стало:** `import CallButton from '../CallButton';`

### 3. Проблемы с экспортами в molecules/index.js
**Было:** `export * from './ActiveCallBar';`
**Стало:** `export { default as ActiveCallBar } from './ActiveCallBar';`

## Исправленные файлы:

1. **ActiveCallBar.jsx** - исправлен путь к createParticipant
2. **VoiceChannelSelector.jsx** - исправлен импорт CallButton
3. **molecules/index.js** - добавлены правильные экспорты для default компонентов
4. **GlobalCallManager.jsx** - исправлен импорт ActiveCallBar

## Результат:

Теперь все импорты должны работать корректно:
- ✅ createParticipant импортируется из правильного пути
- ✅ CallButton импортируется как default export
- ✅ ActiveCallBar экспортируется как named export
- ✅ Все компоненты доступны через правильные импорты

## Проверка:

Все основные компоненты системы звонков теперь должны работать:
- `useGlobalCall` - хук для работы со звонками
- `CallButton` - кнопка для инициации звонков
- `ActiveCallBar` - глобальная панель звонка
- `GlobalCallManager` - менеджер глобальных звонков
- `VoiceCallView` - обновленный интерфейс звонка
