# План реализации музыкального бота

## Что уже сделано

1. ✅ Базовая структура бота (bot.js, musicPlayer.js, commandHandler.js)
2. ✅ Интеграция с LiveKit через @livekit/rtc-node
3. ✅ Обработка аудио потоков через FFmpeg
4. ✅ Система команд
5. ✅ Обработчики на сервере для регистрации бота

## Что нужно сделать дальше

### 1. Установка зависимостей

```bash
cd music-bot
npm install
```

**Важно**: Убедитесь, что установлен FFmpeg:
- Windows: скачайте с https://ffmpeg.org/download.html
- Linux: `apt-get install ffmpeg` или `yum install ffmpeg`
- macOS: `brew install ffmpeg`

### 2. Настройка переменных окружения

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

### 3. Запуск бота

```bash
npm start
```

### 4. Интеграция с клиентом (UI)

Нужно добавить в веб-клиент:

#### 4.1. API для управления ботом

Создать файл `WhithinMessenger.Client/src/entities/music-bot/api/musicBotApi.js`:

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

#### 4.2. UI компонент для управления ботом

Добавить кнопки в `VoiceCallView.jsx`:
- Кнопка "Добавить бота"
- Кнопка "Удалить бота"
- Панель управления музыкой (play, pause, skip, queue)

#### 4.3. Обработка команд в чате

Добавить обработку команд типа `!play <url>` в чате, которые будут отправляться боту.

### 5. Доработка сервера

Добавить обработчики на сервере для команд бота (уже добавлено в server.js):

- `botJoinRoom` - запрос на добавление бота в комнату
- `botLeaveRoom` - запрос на удаление бота из комнаты
- `botCommand` - команда для бота

### 6. Тестирование

1. Запустить бота: `cd music-bot && npm start`
2. Запустить сервер: `cd server && npm start`
3. В веб-клиенте добавить бота в комнату
4. Отправить команду `!play <youtube-url>`
5. Проверить, что музыка воспроизводится

### 7. Дополнительные улучшения (опционально)

- [ ] Поиск музыки (YouTube, Spotify)
- [ ] Отображение текущего трека
- [ ] Управление правами доступа (кто может управлять ботом)
- [ ] Персистентное хранение очередей
- [ ] Поддержка плейлистов
- [ ] Лучшая обработка ошибок и переподключение

## Текущие ограничения

1. **Аудио трек**: Текущая реализация использует правильный подход с `AudioSource` и `AudioFrame`, но требует тестирования
2. **Громкость**: Реализована базовая регулировка громкости через умножение сэмплов
3. **Пауза**: Использует буферизацию, но может потребоваться доработка

## Следующие шаги

1. Установить зависимости и запустить бота
2. Протестировать базовую функциональность
3. Добавить UI в клиент
4. Интегрировать команды в чат
5. Протестировать полный цикл работы
