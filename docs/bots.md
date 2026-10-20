# Whithin Bot Platform

Bots use a **Telegram-style HTTP API** (token + `getUpdates` / webhook) and are installed on servers like **Discord**.

The bot runtime is a separate Go service (`bot-service`). The C# API owns users, membership, messages, and SignalR.

## Create a bot

1. Open **Settings → Боты** in the Whithin client.
2. Create an application, then a bot (username).
3. Copy the token once (`whithin_bot_…`).
4. Pick a server and click **Установить бота на сервер** (you need invite permission).

## Public Bot API

Base URL: `https://whithin.ru/api/bot/v1`  
Auth header: `Authorization: Bot <token>`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/getMe` | Bot identity |
| POST | `/sendMessage` | Body: `{ "chat_id": "<uuid>", "text": "..." }` |
| GET | `/getUpdates?offset=&timeout=` | Long poll updates |
| POST | `/setWebhook` | Body: `{ "url": "https://..." }` |
| POST | `/deleteWebhook` | Remove webhook |
| GET | `/getWebhookInfo` | Current webhook |

Webhook delivery includes:

- `X-Whithin-Timestamp` — unix seconds  
- `X-Whithin-Signature` — HMAC-SHA256 hex of `timestamp + "." + body` with the webhook secret returned by `setWebhook`

## Examples

### Echo

See [`bot-service/examples/echo-bot`](../bot-service/examples/echo-bot).

```bash
export WHITHIN_BOT_TOKEN=whithin_bot_...
export WHITHIN_API=https://whithin.ru/api/bot/v1
go run ./bot-service/examples/echo-bot
```

### Welcome (Discord-style)

Слушает событие `member.joined` и пишет приветствие в канал.

See [`bot-service/examples/welcome-bot`](../bot-service/examples/welcome-bot).

```bash
export WHITHIN_BOT_TOKEN=whithin_bot_...
export WHITHIN_API=https://whithin.ru/api/bot/v1
export WHITHIN_WELCOME_CHAT_ID=<channel-uuid>
go run ./bot-service/examples/welcome-bot
```

Platform event (internal): `member.joined` with `{ serverId, serverName, userId, username }`.

## Architecture notes

- Go stores `bot_*` tables in the same Postgres database.
- Sending a message calls C# `POST /api/internal/bots/messages`, which persists via `SendMessageCommand` and broadcasts `MessageSent`.
- New chat messages are forwarded to Go as `message.created` events for installed bots.
