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
# Используем актуальную версию и пробуем разные форматы URL
RUN set -eux; \
    VERSION="1.9.8"; \
    ARCH="amd64"; \
    OS="linux"; \
    \
    # Пробуем разные варианты URL (правильный формат: livekit_VERSION_OS_ARCH.tar.gz) \
    for url in \
        "https://github.com/livekit/livekit/releases/download/v${VERSION}/livekit_${VERSION}_${OS}_${ARCH}.tar.gz" \
        "https://github.com/livekit/livekit/releases/download/v${VERSION}/livekit-server_${VERSION}_${OS}_${ARCH}.tar.gz" \
        "https://github.com/livekit/livekit/releases/download/v${VERSION}/livekit-server-${OS}-${ARCH}.tar.gz"; \
    do \
        echo "Trying URL: $url"; \
        if curl -L -f -sS -o /tmp/livekit.tar.gz "$url"; then \
            echo "Download successful from: $url"; \
            break; \
        else \
            echo "Failed to download from: $url"; \
            rm -f /tmp/livekit.tar.gz; \
        fi; \
    done; \
    \
    # Проверяем, что файл скачался \
    if [ ! -f /tmp/livekit.tar.gz ]; then \
        echo "Error: Failed to download livekit-server from all URLs"; \
        exit 1; \
    fi; \
    \
    # Проверяем формат файла \
    file_type=$(file /tmp/livekit.tar.gz | cut -d: -f2); \
    echo "Downloaded file type: $file_type"; \
    \
    # Распаковываем архив \
    if echo "$file_type" | grep -q "gzip"; then \
        tar -xzf /tmp/livekit.tar.gz -C /tmp/; \
    elif echo "$file_type" | grep -q "Zip"; then \
        apk add --no-cache unzip; \
        unzip /tmp/livekit.tar.gz -d /tmp/; \
    else \
        echo "Unknown archive format: $file_type"; \
        exit 1; \
    fi; \
    \
    # Ищем бинарник в разных возможных местах \
    # LiveKit может быть в корне архива или в поддиректории \
    if [ -f /tmp/livekit-server ]; then \
        mv /tmp/livekit-server /usr/local/bin/; \
    elif [ -f /tmp/livekit ]; then \
        mv /tmp/livekit /usr/local/bin/livekit-server; \
    elif [ -d /tmp/livekit_${VERSION}_${OS}_${ARCH} ] && [ -f /tmp/livekit_${VERSION}_${OS}_${ARCH}/livekit-server ]; then \
        mv /tmp/livekit_${VERSION}_${OS}_${ARCH}/livekit-server /usr/local/bin/; \
    elif [ -d /tmp/livekit_${VERSION}_${OS}_${ARCH} ] && [ -f /tmp/livekit_${VERSION}_${OS}_${ARCH}/livekit ]; then \
        mv /tmp/livekit_${VERSION}_${OS}_${ARCH}/livekit /usr/local/bin/livekit-server; \
    elif [ -d /tmp/livekit-server_${VERSION}_${OS}_${ARCH} ] && [ -f /tmp/livekit-server_${VERSION}_${OS}_${ARCH}/livekit-server ]; then \
        mv /tmp/livekit-server_${VERSION}_${OS}_${ARCH}/livekit-server /usr/local/bin/; \
    elif [ -d /tmp/livekit-server-${OS}-${ARCH} ] && [ -f /tmp/livekit-server-${OS}-${ARCH}/livekit-server ]; then \
        mv /tmp/livekit-server-${OS}-${ARCH}/livekit-server /usr/local/bin/; \
    else \
        echo "Error: livekit-server binary not found in archive"; \
        echo "Contents of /tmp:"; \
        ls -laR /tmp/; \
        exit 1; \
    fi; \
    \
    chmod +x /usr/local/bin/livekit-server && \
    /usr/local/bin/livekit-server --version && \
    rm -rf /tmp/livekit*.tar.gz /tmp/livekit-server*

WORKDIR /app

# Copy the binary from builder
COPY --from=builder /app/server .

# Copy config file
COPY config.yaml /app/config.yaml

EXPOSE 3000 7880 50000-50100/udp 50000-50100/tcp

# Start both LiveKit server and Go server
# Используем wait для ожидания завершения процессов
CMD sh -c "livekit-server --config /app/config.yaml & sleep 2 && ./server & wait"

