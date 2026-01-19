# Следующие шаги для запуска музыкального бота

## 1. Установка зависимостей

```bash
cd music-bot
npm install
```

**Важно**: Убедитесь, что установлен FFmpeg:
- Windows: скачайте с https://ffmpeg.org/download.html и добавьте в PATH
- Linux: `sudo apt-get install ffmpeg` или `sudo yum install ffmpeg`
- macOS: `brew install ffmpeg`

## 2. Настройка

Создайте файл `.env` в папке `music-bot`:

```env
LIVEKIT_URL=wss://whithin.ru
LIVEKIT_API_KEY=devkey
LIVEKIT_API_SECRET=this_is_a_very_long_secret_key_for_livekit_server_at_least_32_chars
VOICE_SERVER_URL=https://whithin.ru
BOT_USER_ID=music-bot-001
BOT_USER_NAME=Music Bot
BOT_PORT=3001
```

## 3. Запуск бота

### Вариант 1: Локальный запуск (для разработки)

```bash
npm start
```

Или для разработки с автоперезагрузкой:

```bash
npm run dev
```

### Вариант 2: Docker (для production)

Бот уже настроен для работы в Docker. Для запуска:

```bash
# Из корневой папки проекта
docker-compose up -d music-bot

# Или для пересборки
docker-compose up -d --build music-bot
```

Бот будет автоматически запускаться вместе с остальными сервисами при `docker-compose up -d`.

## 4. Что уже реализовано

✅ **MusicPlayer** - правильная работа с LiveKit через `@livekit/rtc-node`:
- Создание `AudioSource` и `LocalAudioTrack`
- Обработка аудио потоков через FFmpeg
- Конвертация в PCM формат и передача в LiveKit через `AudioFrame`
- Управление громкостью
- Очередь треков

✅ **Интеграция с сервером**:
- Обработчики на сервере для регистрации бота
- Обработчики для команд (`botJoinRoom`, `botLeaveRoom`, `botCommand`)
- Передача сообщений от бота клиентам

✅ **Система команд**:
- `!play <url>` - добавить в очередь
- `!pause` - приостановить
- `!resume` - возобновить
- `!stop` - остановить
- `!skip` - следующий трек
- `!queue` - показать очередь
- `!clear` - очистить очередь
- `!volume <0-100>` - установить громкость
- `!help` - справка

## 5. Что нужно добавить в клиент

### 5.1. API для управления ботом

Создать `WhithinMessenger.Client/src/entities/music-bot/api/musicBotApi.js`:

```javascript
import { io } from 'socket.io-client';

const VOICE_SERVER_URL = import.meta.env.VITE_VOICE_SERVER_URL || 'https://whithin.ru';

class MusicBotApi {
  constructor() {
    this.socket = null;
  }

  connect() {
    if (this.socket?.connected) return this.socket;
    
    this.socket = io(VOICE_SERVER_URL, {
      transports: ['websocket']
    });
    
    return this.socket;
  }

  async addBotToRoom(roomId) {
    const socket = this.connect();
    return new Promise((resolve, reject) => {
      socket.emit('botJoinRoom', { roomId }, (response) => {
        if (response.error) {
          reject(new Error(response.error));
        } else {
          resolve(response);
        }
      });
    });
  }

  async removeBotFromRoom(roomId) {
    const socket = this.connect();
    return new Promise((resolve, reject) => {
      socket.emit('botLeaveRoom', { roomId }, (response) => {
        if (response.error) {
          reject(new Error(response.error));
        } else {
          resolve(response);
        }
      });
    });
  }

  sendCommand(roomId, command, args = []) {
    const socket = this.connect();
    socket.emit('botCommand', { roomId, command, args });
  }

  onBotMessage(callback) {
    const socket = this.connect();
    socket.on('botMessage', callback);
  }
}

export const musicBotApi = new MusicBotApi();
```

### 5.2. UI компонент

Добавить в `VoiceCallView.jsx`:
- Кнопку для добавления/удаления бота
- Панель управления музыкой (если бот в комнате)
- Отображение текущего трека и очереди

### 5.3. Интеграция с чатом

Добавить обработку команд в чате (например, в `ChatScreen.jsx`):
- Если сообщение начинается с `!`, отправлять команду боту
- Отображать ответы бота в чате

## 6. Тестирование

1. Запустить бота: `cd music-bot && npm start`
2. Запустить сервер: `cd server && npm start`
3. В веб-клиенте:
   - Открыть голосовой канал
   - Добавить бота в комнату
   - Отправить команду `!play https://www.youtube.com/watch?v=...`
   - Проверить, что музыка воспроизводится

## 7. Возможные проблемы и решения

### Проблема: Бот не подключается к LiveKit
- Проверьте `LIVEKIT_URL` и `LIVEKIT_API_KEY/SECRET` в `.env`
- Убедитесь, что LiveKit сервер запущен

### Проблема: FFmpeg не найден
- Установите FFmpeg и добавьте в PATH
- Проверьте: `ffmpeg -version`

### Проблема: Аудио не воспроизводится
- Проверьте логи бота на ошибки
- Убедитесь, что URL валидный и доступен
- Проверьте, что трек опубликован: `[MusicPlayer] Audio track published`

### Проблема: Команды не работают
- Убедитесь, что бот подключен к серверу через Socket.IO
- Проверьте, что обработчики на сервере добавлены
- Проверьте логи сервера и бота

## 8. Дополнительные улучшения

После базовой реализации можно добавить:
- Поиск музыки (YouTube API, Spotify)
- Отображение метаданных треков (название, автор, обложка)
- Управление правами (кто может управлять ботом)
- Персистентные очереди (сохранение в БД)
- Плейлисты
- Лучшая обработка ошибок и автоматическое переподключение
