package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"
)

func main() {
	token := os.Getenv("WHITHIN_BOT_TOKEN")
	api := getenv("WHITHIN_API", "https://whithin.ru/api/bot/v1")
	chatID := os.Getenv("WHITHIN_WELCOME_CHAT_ID")
	serverFilter := os.Getenv("WHITHIN_SERVER_ID") // optional: only this server
	template := getenv(
		"WHITHIN_WELCOME_TEXT",
		"Добро пожаловать на сервер{server}, {user}! Рады тебя видеть 👋",
	)

	if token == "" || chatID == "" {
		fmt.Println("Set WHITHIN_BOT_TOKEN and WHITHIN_WELCOME_CHAT_ID")
		os.Exit(1)
	}

	fmt.Println("welcome-bot started; listening for member.joined…")
	client := &http.Client{Timeout: 70 * time.Second}
	var offset int64

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
			typ, _ := u.Payload["type"].(string)
			if typ != "member.joined" {
				continue
			}
			member, _ := u.Payload["member"].(map[string]any)
			server, _ := u.Payload["server"].(map[string]any)
			username, _ := member["username"].(string)
			serverID := fmt.Sprint(server["id"])
			serverName, _ := server["name"].(string)
			if username == "" {
				username = "друг"
			}
			if serverFilter != "" && !strings.EqualFold(serverID, serverFilter) {
				continue
			}

			text := template
			text = strings.ReplaceAll(text, "{user}", "@"+username)
			if serverName != "" {
				text = strings.ReplaceAll(text, "{server}", " «"+serverName+"»")
			} else {
				text = strings.ReplaceAll(text, "{server}", "")
			}

			if err := sendMessage(client, api, token, chatID, text); err != nil {
				fmt.Println("sendMessage:", err)
			} else {
				fmt.Printf("welcomed %s on server %s\n", username, serverID)
			}
		}
	}
}

func getenv(k, def string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return def
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
