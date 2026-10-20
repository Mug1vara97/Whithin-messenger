FROM golang:1.22-alpine AS build
WORKDIR /src
RUN apk add --no-cache git ca-certificates
COPY go.mod ./
RUN go mod download
COPY . .
RUN go mod tidy && CGO_ENABLED=0 GOOS=linux go build -o /out/bot-service ./cmd/bot-service

FROM alpine:3.20
RUN apk add --no-cache ca-certificates
WORKDIR /app
COPY --from=build /out/bot-service /app/bot-service
COPY migrations /app/migrations
EXPOSE 8091
ENTRYPOINT ["/app/bot-service"]
