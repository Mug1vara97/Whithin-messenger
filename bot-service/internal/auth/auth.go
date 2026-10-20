package auth

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"net/http"
	"strings"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

var ErrUnauthorized = errors.New("unauthorized")

type UserClaims struct {
	UserID   uuid.UUID
	Username string
}

func ParseUserJWT(r *http.Request, issuer, audience, key string) (UserClaims, error) {
	header := r.Header.Get("Authorization")
	if !strings.HasPrefix(header, "Bearer ") {
		return UserClaims{}, ErrUnauthorized
	}
	raw := strings.TrimSpace(strings.TrimPrefix(header, "Bearer "))
	token, err := jwt.Parse(raw, func(t *jwt.Token) (interface{}, error) {
		if t.Method.Alg() != jwt.SigningMethodHS256.Alg() {
			return nil, fmt.Errorf("unexpected alg")
		}
		return []byte(key), nil
	}, jwt.WithIssuer(issuer), jwt.WithAudience(audience))
	if err != nil || !token.Valid {
		return UserClaims{}, ErrUnauthorized
	}
	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return UserClaims{}, ErrUnauthorized
	}
	uidStr, _ := claims["UserId"].(string)
	if uidStr == "" {
		uidStr, _ = claims["userId"].(string)
	}
	uid, err := uuid.Parse(uidStr)
	if err != nil {
		return UserClaims{}, ErrUnauthorized
	}
	username, _ := claims["Username"].(string)
	if username == "" {
		username, _ = claims["username"].(string)
	}
	return UserClaims{UserID: uid, Username: username}, nil
}

func ParseBotToken(r *http.Request) (string, error) {
	header := r.Header.Get("Authorization")
	if strings.HasPrefix(header, "Bot ") {
		return strings.TrimSpace(strings.TrimPrefix(header, "Bot ")), nil
	}
	if strings.HasPrefix(header, "Bearer ") {
		// allow Bearer for convenience
		tok := strings.TrimSpace(strings.TrimPrefix(header, "Bearer "))
		if strings.HasPrefix(tok, "whithin_bot_") {
			return tok, nil
		}
	}
	return "", ErrUnauthorized
}

func HashToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

func NewBotToken() (plain string, hash string, prefix string, err error) {
	buf := make([]byte, 32)
	if _, err = rand.Read(buf); err != nil {
		return
	}
	plain = "whithin_bot_" + base64.RawURLEncoding.EncodeToString(buf)
	hash = HashToken(plain)
	prefix = plain
	if len(prefix) > 16 {
		prefix = prefix[:16]
	}
	return
}

func RequireInternalKey(r *http.Request, expected string) bool {
	return r.Header.Get("X-Internal-Key") == expected
}
