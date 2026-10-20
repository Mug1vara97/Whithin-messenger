package coreclient

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"
)

type Client struct {
	baseURL string
	apiKey  string
	http    *http.Client
}

func New(baseURL, apiKey string) *Client {
	return &Client{
		baseURL: strings.TrimRight(baseURL, "/"),
		apiKey:  apiKey,
		http:    &http.Client{Timeout: 15 * time.Second},
	}
}

type CreateBotUserResult struct {
	UserID      uuid.UUID `json:"userId"`
	Username    string    `json:"username"`
	DisplayName *string   `json:"displayName"`
	IsBot       bool      `json:"isBot"`
}

type SendMessageResult struct {
	MessageID uuid.UUID `json:"messageId"`
	ChatID    uuid.UUID `json:"chatId"`
}

func (c *Client) CreateBotUser(ctx context.Context, username string, displayName *string) (CreateBotUserResult, error) {
	body := map[string]any{"username": username, "displayName": displayName}
	var out CreateBotUserResult
	err := c.post(ctx, "/api/internal/bots/users", body, &out)
	return out, err
}

func (c *Client) InstallBot(ctx context.Context, serverID, botUserID, installedBy uuid.UUID) error {
	body := map[string]any{
		"serverId":         serverID,
		"botUserId":        botUserID,
		"installedByUserId": installedBy,
	}
	return c.post(ctx, "/api/internal/bots/installs", body, nil)
}

func (c *Client) SendMessage(ctx context.Context, chatID, botUserID uuid.UUID, content string, replyTo *uuid.UUID) (SendMessageResult, error) {
	body := map[string]any{
		"chatId":    chatID,
		"botUserId": botUserID,
		"content":   content,
	}
	if replyTo != nil {
		body["replyToMessageId"] = *replyTo
	}
	var out SendMessageResult
	err := c.post(ctx, "/api/internal/bots/messages", body, &out)
	return out, err
}

func (c *Client) post(ctx context.Context, path string, body any, out any) error {
	raw, err := json.Marshal(body)
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+path, bytes.NewReader(raw))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Internal-Key", c.apiKey)
	resp, err := c.http.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	data, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 300 {
		return fmt.Errorf("core api %s: %s", resp.Status, string(data))
	}
	if out == nil || len(data) == 0 {
		return nil
	}
	return json.Unmarshal(data, out)
}
