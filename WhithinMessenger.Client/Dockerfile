# Build stage — pure JS/Vite client, no native node-gyp deps.
FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./

RUN npm ci --legacy-peer-deps || npm install --legacy-peer-deps && \
    npm cache clean --force

COPY src ./src
COPY public ./public
COPY index.html ./
COPY vite.config.js ./

ENV VITE_API_URL=https://whithin.ru
ENV VITE_API_BASE_URL=https://whithin.ru
ENV VITE_VOICE_SERVER_URL=https://whithin.ru
ENV NODE_ENV=production

RUN npm run build && \
    npm cache clean --force && \
    rm -rf node_modules

FROM node:20-alpine

WORKDIR /app

RUN npm install -g serve

COPY --from=build /app/dist ./dist

EXPOSE 3001

CMD ["serve", "-s", "dist", "-l", "3001"]
