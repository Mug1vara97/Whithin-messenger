package config

import (
	"os"
	"strconv"
)

type Config struct {
	Port           string
	DatabaseURL    string
	CoreAPIBaseURL string
	InternalAPIKey string
	JWTIssuer      string
	JWTAudience    string
	JWTKey         string
}

func Load() Config {
	return Config{
		Port:           getenv("PORT", "8091"),
		DatabaseURL:    getenv("DATABASE_URL", "postgres://postgres:1000-7@localhost:5432/whithin_db?sslmode=disable"),
		CoreAPIBaseURL: getenv("CORE_API_BASE_URL", "http://localhost:8080"),
		InternalAPIKey: getenv("INTERNAL_API_KEY", "whithin-bot-internal-dev-key"),
		JWTIssuer:      getenv("JWT_ISSUER", "https://whithin.ru"),
		JWTAudience:    getenv("JWT_AUDIENCE", "https://whithin.ru"),
		JWTKey:         getenv("JWT_KEY", "WhithinMessenger2024!SuperSecretJWTKeyForTesting123456789"),
	}
}

func getenv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func getenvInt(key string, fallback int) int {
	if v := os.Getenv(key); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			return n
		}
	}
	return fallback
}
