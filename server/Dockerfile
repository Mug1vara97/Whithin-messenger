# ЭТАП 1: Сборка зависимостей
FROM node:18-bullseye AS builder

# Install dependencies for mediasoup compilation
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    make \
    gcc \
    g++ \
    build-essential \
    libc6-dev \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

# ЭТАП 2: Финальный образ
FROM node:18-bullseye-slim

# Копируем только скомпилированные node_modules
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules

# Копируем исходный код
COPY . .

EXPOSE 3000 40000-40100/udp 40000-40100/tcp

CMD ["npm", "start"] 