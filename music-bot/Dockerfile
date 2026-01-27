# ЭТАП 1: Сборка зависимостей
FROM node:18-bullseye AS builder

WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev

# ЭТАП 2: Финальный образ
FROM node:18-bullseye-slim

# FFmpeg — для декодирования аудио из Яндекс.Музыки
RUN apt-get update && apt-get install -y \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Копируем node_modules из builder
COPY --from=builder /app/node_modules ./node_modules

# Копируем исходный код
COPY . .

EXPOSE 3001

CMD ["npm", "start"]
