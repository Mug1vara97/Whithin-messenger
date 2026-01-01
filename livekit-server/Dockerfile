# Build stage
FROM golang:1.21-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache git

# Copy go mod files
COPY go.mod go.sum ./
RUN go mod download

# Copy source code
COPY . .

# Build the application
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o server .

# Final stage
FROM alpine:latest

# Install LiveKit server and dependencies
RUN apk add --no-cache ca-certificates curl tar gzip

# Download and install LiveKit server
# Используем конкретную версию для стабильности
RUN curl -L -o /tmp/livekit-server.tar.gz https://github.com/livekit/livekit/releases/download/v1.5.2/livekit-server-linux-amd64.tar.gz && \
    tar -xzf /tmp/livekit-server.tar.gz -C /usr/local/bin/ && \
    chmod +x /usr/local/bin/livekit-server && \
    rm /tmp/livekit-server.tar.gz

WORKDIR /app

# Copy the binary from builder
COPY --from=builder /app/server .

# Copy config file
COPY config.yaml /app/config.yaml

EXPOSE 3000 7880 50000-50100/udp 50000-50100/tcp

# Start both LiveKit server and Go server
# Используем wait для ожидания завершения процессов
CMD sh -c "livekit-server --config /app/config.yaml & sleep 2 && ./server & wait"

