# Welcome bot

Пишет «Добро пожаловать…» в выбранный канал, когда человек **впервые заходит на сервер** (join / add member).

## Подготовка

1. Settings → **Боты** → создайте приложение и бота, сохраните токен.
2. Установите бота на нужный сервер.
3. Скопируйте `chatId` канала для приветствий (из URL/API или DevTools у сообщения в канале).

## Запуск

```bash
set WHITHIN_BOT_TOKEN=whithin_bot_...
set WHITHIN_API=https://whithin.ru/api/bot/v1
set WHITHIN_WELCOME_CHAT_ID=<uuid канала>
REM optional:
set WHITHIN_SERVER_ID=<uuid сервера>
set WHITHIN_WELCOME_TEXT=Добро пожаловать{server}, {user}!

go run .
```

Плейсхолдеры в тексте: `{user}` → `@ник`, `{server}` → ` «Имя сервера»` (или пусто).
