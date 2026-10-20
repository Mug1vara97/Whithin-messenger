package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"time"
)

func main() {
	token := os.Getenv("WHITHIN_BOT_TOKEN")
	api := os.Getenv("WHITHIN_API")
	if api == "" {
		api = "https://whithin.ru/api/bot/v1"
	}
	if token == "" {
		fmt.Println("Set WHITHIN_BOT_TOKEN")
		os.Exit(1)
	}

	var offset int64
	client := &http.Client{Timeout: 70 * time.Second}

	for {
		updates, err := getUpdates(client, api, token, offset)
		if err != nil {
			fmt.Println("getUpdates:", err)
			time.Sleep(2 * time.Second)
			continue
		}
		for _, u := range updates {
			if u.UpdateID >= offset {
				offset = u.UpdateID + 1
			}
			text, _ := u.Payload["message"].(map[string]any)
			if text == nil {
				continue
			}
			msg, _ := text["text"].(string)
			chat, _ := text["chat"].(map[string]any)
			chatID, _ := chat["id"].(string)
			if chatID == "" {
				if id, ok := chat["id"].(float64); ok {
					chatID = fmt.Sprintf("%.0f", id)
				}
			}
			// UUID comes as string from our API.
			if id, ok := chat["id"].(string); ok {
				chatID = id
			}
			if msg == "" || chatID == "" {
				continue
			}
			if err := sendMessage(client, api, token, chatID, "echo: "+msg); err != nil {
				fmt.Println("sendMessage:", err)
			}
		}
	}
}

type updateEnvelope struct {
	UpdateID int64          `json:"update_id"`
	Payload  map[string]any `json:"payload"`
}

func getUpdates(client *http.Client, api, token string, offset int64) ([]updateEnvelope, error) {
	url := fmt.Sprintf("%s/getUpdates?timeout=30&offset=%d", api, offset)
	req, _ := http.NewRequest(http.MethodGet, url, nil)
	req.Header.Set("Authorization", "Bot "+token)
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	var parsed struct {
		OK     bool             `json:"ok"`
		Result []updateEnvelope `json:"result"`
		Error  string           `json:"error"`
	}
	if err := json.Unmarshal(body, &parsed); err != nil {
		return nil, err
	}
	if !parsed.OK {
		return nil, fmt.Errorf("%s", parsed.Error)
	}
	return parsed.Result, nil
}

func sendMessage(client *http.Client, api, token, chatID, text string) error {
	payload, _ := json.Marshal(map[string]any{"chat_id": chatID, "text": text})
	req, _ := http.NewRequest(http.MethodPost, api+"/sendMessage", bytes.NewReader(payload))
	req.Header.Set("Authorization", "Bot "+token)
	req.Header.Set("Content-Type", "application/json")
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		b, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("%s: %s", resp.Status, string(b))
	}
	return nil
}
