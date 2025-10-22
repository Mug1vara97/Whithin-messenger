# Система глобальных звонков

## Обзор

Реализована система глобальных звонков, которая позволяет звонкам работать в фоне независимо от переключения компонентов и страниц. Система построена на Zustand для управления состоянием и React Context для глобального доступа.

## Архитектура

### 1. Zustand Store (`callStore.js`)
- **Назначение**: Центральное хранилище состояния звонков
- **Особенности**: 
  - Хранит WebRTC соединения глобально
  - Управляет участниками, аудио настройками, шумоподавлением
  - Не зависит от жизненного цикла компонентов

### 2. CallContext (`CallContext.jsx`)
- **Назначение**: React Context для доступа к состоянию звонков
- **Особенности**:
  - Предоставляет удобный API для компонентов
  - Обрабатывает инициализацию из localStorage
  - Управляет глобальными обработчиками событий

### 3. useGlobalCall Hook (`useGlobalCall.js`)
- **Назначение**: Удобный хук для работы со звонками
- **Особенности**:
  - Автоматическое подключение при наличии пользователя
  - Упрощенные методы для управления звонками
  - Интеграция с системой аутентификации

## Компоненты

### 1. ActiveCallBar
- **Назначение**: Глобальная панель активного звонка
- **Особенности**:
  - Отображается поверх всех страниц
  - Содержит основные элементы управления
  - Разворачивается для показа участников
  - Автоматически скрывается при отсутствии звонка

### 2. CallButton
- **Назначение**: Кнопка для инициации/завершения звонков
- **Особенности**:
  - Адаптивные размеры и стили
  - Показывает состояние звонка
  - Интегрируется в любые компоненты

### 3. GlobalCallManager
- **Назначение**: Глобальный менеджер звонков
- **Особенности**:
  - Рендерит ActiveCallBar
  - Интегрирован в корень приложения

## Использование

### Базовое использование

```jsx
import { useGlobalCall } from '../shared/lib/hooks/useGlobalCall';

const MyComponent = () => {
  const { startCall, endCall, isCallActive } = useGlobalCall();
  
  const handleStartCall = async () => {
    await startCall('room-123', 'My Room');
  };
  
  return (
    <div>
      {isCallActive ? (
        <button onClick={endCall}>Завершить звонок</button>
      ) : (
        <button onClick={handleStartCall}>Начать звонок</button>
      )}
    </div>
  );
};
```

### Использование CallButton

```jsx
import { CallButton } from '../shared/ui/molecules';

const ChannelComponent = ({ channelId, channelName }) => {
  return (
    <div>
      <h3>{channelName}</h3>
      <CallButton
        channelId={channelId}
        channelName={channelName}
        variant="primary"
        size="large"
      />
    </div>
  );
};
```

### Прямое использование store

```jsx
import { useCallStore } from '../shared/lib/stores/callStore';

const AdvancedComponent = () => {
  const store = useCallStore();
  
  // Прямой доступ к состоянию
  const participants = store.participants;
  const isMuted = store.isMuted;
  
  // Прямые действия
  const toggleMute = () => store.toggleMute();
  
  return (
    <div>
      <p>Участников: {participants.length}</p>
      <button onClick={toggleMute}>
        {isMuted ? 'Включить' : 'Выключить'} микрофон
      </button>
    </div>
  );
};
```

## Ключевые особенности

### 1. Непрерывность звонков
- Звонки продолжают работать при переключении страниц
- WebRTC соединения хранятся глобально
- Состояние сохраняется между навигацией

### 2. Глобальная панель
- ActiveCallBar видна на всех страницах
- Содержит основные элементы управления
- Автоматически адаптируется к размеру экрана

### 3. Интеграция с существующей системой
- Использует существующие API для голосовых звонков
- Совместим с текущей архитектурой
- Не нарушает работу других компонентов

### 4. Управление состоянием
- Zustand для эффективного управления состоянием
- Автоматическая синхронизация между компонентами
- Персистентность настроек (шумоподавление, громкость)

## API Reference

### useGlobalCall Hook

#### Состояние
- `isCallActive: boolean` - Активен ли звонок
- `participants: Array` - Список участников
- `isMuted: boolean` - Заглушен ли микрофон
- `isGlobalAudioMuted: boolean` - Выключен ли звук всех участников
- `error: string | null` - Ошибка, если есть

#### Методы
- `startCall(roomId, roomName): Promise<boolean>` - Начать звонок
- `endCall(): Promise<void>` - Завершить звонок
- `toggleMute(): void` - Переключить микрофон
- `toggleGlobalAudio(): void` - Переключить звук всех участников
- `getCallInfo(): Object` - Получить информацию о звонке

### CallButton Props
- `channelId: string` - ID канала
- `channelName: string` - Название канала
- `className?: string` - Дополнительные CSS классы
- `size?: 'small' | 'medium' | 'large'` - Размер кнопки
- `variant?: 'primary' | 'secondary' | 'success' | 'danger'` - Стиль кнопки

## Стилизация

### CSS переменные
```css
:root {
  --call-primary: #5865f2;
  --call-success: #00d166;
  --call-danger: #f04747;
  --call-background: #1e1f22;
  --call-surface: #2c2f33;
  --call-text: #f2f3f5;
  --call-text-secondary: #8e9297;
}
```

### Адаптивность
- Все компоненты адаптивны для мобильных устройств
- Используются медиа-запросы для разных размеров экрана
- Оптимизированы для touch-интерфейсов

## Отладка

### Логирование
```javascript
// Включить детальное логирование
localStorage.setItem('debug', 'call:*');

// Логирование в консоли
console.log('Call state:', useCallStore.getState());
```

### Проверка состояния
```javascript
// Проверить активность звонка
const { isCallActive, getCallInfo } = useGlobalCall();
console.log('Call info:', getCallInfo());
```

## Миграция

### Из старой системы
1. Замените `useVoiceCall` на `useGlobalCall`
2. Удалите локальное управление состоянием звонков
3. Используйте `CallButton` вместо кастомных кнопок
4. Убедитесь, что `CallProvider` добавлен в `AppProviders`

### Обратная совместимость
- Старые компоненты продолжают работать
- Постепенная миграция возможна
- API остается совместимым

## Производительность

### Оптимизации
- Zustand использует селективное обновление
- Компоненты перерендериваются только при изменении нужных данных
- WebRTC соединения управляются эффективно
- Минимальное использование памяти

### Мониторинг
```javascript
// Подписка на изменения состояния
useCallStore.subscribe((state) => {
  console.log('Call state changed:', state);
});
```

## Безопасность

### Валидация
- Все входные данные валидируются
- Проверка прав доступа к каналам
- Защита от XSS через санитизацию

### Приватность
- Аудио потоки не сохраняются
- Соединения зашифрованы
- Локальные настройки не передаются на сервер

## Поддержка

### Браузеры
- Chrome 80+
- Firefox 75+
- Safari 13+
- Edge 80+

### Мобильные
- iOS Safari 13+
- Chrome Mobile 80+
- Samsung Internet 12+

## Примеры использования

### Простой звонок
```jsx
const SimpleCall = () => {
  const { startCall, endCall, isCallActive } = useGlobalCall();
  
  return (
    <button onClick={() => isCallActive ? endCall() : startCall('room-1', 'Room 1')}>
      {isCallActive ? 'Завершить' : 'Начать'} звонок
    </button>
  );
};
```

### Управление участниками
```jsx
const ParticipantsList = () => {
  const { participants, toggleUserMute, changeUserVolume } = useGlobalCall();
  
  return (
    <div>
      {participants.map(participant => (
        <div key={participant.userId}>
          <span>{participant.name}</span>
          <button onClick={() => toggleUserMute(participant.userId)}>
            {participant.isMuted ? 'Включить' : 'Выключить'}
          </button>
          <input
            type="range"
            min="0"
            max="100"
            onChange={(e) => changeUserVolume(participant.userId, e.target.value)}
          />
        </div>
      ))}
    </div>
  );
};
```

### Настройки аудио
```jsx
const AudioSettings = () => {
  const { 
    isNoiseSuppressed, 
    noiseSuppressionMode, 
    toggleNoiseSuppression,
    changeNoiseSuppressionMode 
  } = useGlobalCall();
  
  return (
    <div>
      <label>
        <input
          type="checkbox"
          checked={isNoiseSuppressed}
          onChange={toggleNoiseSuppression}
        />
        Шумоподавление
      </label>
      
      <select 
        value={noiseSuppressionMode} 
        onChange={(e) => changeNoiseSuppressionMode(e.target.value)}
      >
        <option value="rnnoise">RNNoise (AI)</option>
        <option value="speex">Speex</option>
        <option value="noisegate">Noise Gate</option>
      </select>
    </div>
  );
};
```
