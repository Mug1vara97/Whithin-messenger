package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"github.com/joho/godotenv"
	"github.com/livekit/protocol/auth"
)

type Config struct {
	Port           string
	LiveKitURL     string
	LiveKitAPIKey  string
	LiveKitAPISecret string
	TLSCert        string
	TLSKey         string
	CORSOrigin     string
}

type UserVoiceState struct {
	IsMuted         bool   `json:"isMuted"`
	IsAudioDisabled  bool   `json:"isAudioDisabled"`
	ChannelID       string `json:"channelId"`
	UserName        string `json:"userName"`
}

type Participant struct {
	UserID          string `json:"userId"`
	Name            string `json:"name"`
	IsMuted         bool   `json:"isMuted"`
	IsSpeaking      bool   `json:"isSpeaking"`
	IsAudioDisabled bool   `json:"isAudioDisabled"`
	IsActive        bool   `json:"isActive"`
}

type Server struct {
	config          *Config
	httpClient      *http.Client
	userVoiceStates map[string]*UserVoiceState
	mu              sync.RWMutex
	upgrader        websocket.Upgrader
	mux             *http.ServeMux
}

func NewServer(cfg *Config) (*Server, error) {
	httpClient := &http.Client{
		Timeout: 10 * time.Second,
	}
	
	upgrader := websocket.Upgrader{
		ReadBufferSize:  1024,
		WriteBufferSize: 1024,
		CheckOrigin: func(r *http.Request) bool {
			// Разрешаем все origins для разработки
			// В продакшене проверяйте origin
			origin := r.Header.Get("Origin")
			log.Printf("WebSocket Origin: %s", origin)
			if origin == "" {
				return true // Прямое подключение без Origin (может быть через прокси)
			}
			// Разрешаем origins с whithin.ru
			return strings.Contains(origin, "whithin.ru") || strings.Contains(origin, "localhost")
		},
		EnableCompression: true,
	}

	srv := &Server{
		config:          cfg,
		httpClient:      httpClient,
		userVoiceStates: make(map[string]*UserVoiceState),
		upgrader:        upgrader,
		mux:             http.NewServeMux(),
	}
	
	srv.setupRoutes()
	
	return srv, nil
}

func (s *Server) updateUserVoiceState(userID string, updates map[string]interface{}) {
	s.mu.Lock()
	defer s.mu.Unlock()

	state, exists := s.userVoiceStates[userID]
	if !exists {
		state = &UserVoiceState{
			IsMuted:        false,
			IsAudioDisabled: false,
			ChannelID:      "",
			UserName:       "Unknown",
		}
		s.userVoiceStates[userID] = state
	}

	if userName, ok := updates["userName"].(string); ok {
		state.UserName = userName
	}
	if channelID, ok := updates["channelId"].(string); ok {
		state.ChannelID = channelID
	}
	if isMuted, ok := updates["isMuted"].(bool); ok {
		state.IsMuted = isMuted
	}
	if isAudioDisabled, ok := updates["isAudioDisabled"].(bool); ok {
		state.IsAudioDisabled = isAudioDisabled
	}
}

func (s *Server) getUserVoiceState(userID string) *UserVoiceState {
	s.mu.RLock()
	defer s.mu.RUnlock()

	state, exists := s.userVoiceStates[userID]
	if !exists {
		return &UserVoiceState{
			IsMuted:        false,
			IsAudioDisabled: false,
			ChannelID:      "",
			UserName:       "Unknown",
		}
	}
	return state
}

func (s *Server) generateToken(roomName, participantIdentity, participantName string) (string, error) {
	at := auth.NewAccessToken(s.config.LiveKitAPIKey, s.config.LiveKitAPISecret)
	
	canPublish := true
	canSubscribe := true
	grant := &auth.VideoGrant{
		RoomJoin:     true,
		Room:         roomName,
		CanPublish:   &canPublish,
		CanSubscribe: &canSubscribe,
	}
	
	at.AddGrant(grant).
		SetIdentity(participantIdentity).
		SetName(participantName).
		SetValidFor(24 * time.Hour)

	return at.ToJWT()
}

// RoomInfo представляет информацию о комнате LiveKit
type RoomInfo struct {
	Name         string         `json:"name"`
	Participants []ParticipantInfo `json:"participants"`
}

// ParticipantInfo представляет информацию об участнике
type ParticipantInfo struct {
	Identity string `json:"identity"`
	Name     string `json:"name"`
}

// getRoomInfo получает информацию о комнате через HTTP API LiveKit
func (s *Server) getRoomInfo(roomName string) (*RoomInfo, error) {
	// Получаем базовый URL LiveKit (без ws:// или wss://)
	baseURL := strings.TrimPrefix(s.config.LiveKitURL, "ws://")
	baseURL = strings.TrimPrefix(baseURL, "wss://")
	baseURL = strings.TrimPrefix(baseURL, "http://")
	baseURL = strings.TrimPrefix(baseURL, "https://")
	
	// Формируем URL для HTTP API (LiveKit использует Twirp)
	apiURL := fmt.Sprintf("http://%s/twirp/livekit.RoomService/ListRooms", baseURL)
	
	// Создаем запрос
	reqBody := map[string]interface{}{
		"names": []string{roomName},
	}
	jsonData, err := json.Marshal(reqBody)
	if err != nil {
		return nil, err
	}
	
	req, err := http.NewRequest("POST", apiURL, bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, err
	}
	
	// Добавляем заголовки для аутентификации
	at := auth.NewAccessToken(s.config.LiveKitAPIKey, s.config.LiveKitAPISecret)
	at.AddGrant(&auth.VideoGrant{}).SetValidFor(1 * time.Hour)
	token, err := at.ToJWT()
	if err != nil {
		return nil, err
	}
	
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")
	
	// Выполняем запрос
	resp, err := s.httpClient.Do(req)
	if err != nil {
		// Если не удалось подключиться, возвращаем пустую комнату
		// Клиент LiveKit сам получит информацию об участниках через события
		log.Printf("Failed to get room info from LiveKit: %v", err)
		return &RoomInfo{
			Name:         roomName,
			Participants: []ParticipantInfo{},
		}, nil
	}
	defer resp.Body.Close()
	
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		log.Printf("LiveKit API error: %s - %s", resp.Status, string(body))
		// Возвращаем пустую комнату вместо ошибки
		return &RoomInfo{
			Name:         roomName,
			Participants: []ParticipantInfo{},
		}, nil
	}
	
	var result struct {
		Rooms []RoomInfo `json:"rooms"`
	}
	
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		log.Printf("Failed to decode LiveKit response: %v", err)
		return &RoomInfo{
			Name:         roomName,
			Participants: []ParticipantInfo{},
		}, nil
	}
	
	// Ищем нужную комнату
	for _, room := range result.Rooms {
		if room.Name == roomName {
			return &room, nil
		}
	}
	
	// Комната не найдена, возвращаем пустую
	return &RoomInfo{
		Name:         roomName,
		Participants: []ParticipantInfo{},
	}, nil
}

func (s *Server) handleWebSocket(w http.ResponseWriter, r *http.Request) {
	log.Printf("WebSocket request: Method=%s, Path=%s, RemoteAddr=%s", r.Method, r.URL.Path, r.RemoteAddr)
	log.Printf("WebSocket headers: Upgrade=%s, Connection=%s, Sec-WebSocket-Key=%s, Sec-WebSocket-Version=%s", 
		r.Header.Get("Upgrade"), 
		r.Header.Get("Connection"), 
		r.Header.Get("Sec-WebSocket-Key"), 
		r.Header.Get("Sec-WebSocket-Version"))
	
	// Убеждаемся, что это WebSocket upgrade запрос
	if !websocket.IsWebSocketUpgrade(r) {
		log.Printf("Not a WebSocket upgrade request")
		http.Error(w, "Expected WebSocket upgrade", http.StatusBadRequest)
		return
	}
	
	conn, err := s.upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("WebSocket upgrade error: %v", err)
		http.Error(w, fmt.Sprintf("WebSocket upgrade failed: %v", err), http.StatusBadRequest)
		return
	}
	defer conn.Close()

	log.Printf("WebSocket connection established: RemoteAddr=%s", conn.RemoteAddr())

	var currentUserID string
	var currentRoomID string

	for {
		var msg map[string]interface{}
		if err := conn.ReadJSON(&msg); err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("Read error: %v", err)
			} else {
				log.Printf("Client disconnected: %v", err)
			}
			break
		}
		
		log.Printf("Received message: %+v", msg)

		event, ok := msg["event"].(string)
		if !ok {
			log.Printf("Invalid message format: missing event")
			continue
		}
		
		data, ok := msg["data"].(map[string]interface{})
		if !ok {
			log.Printf("Invalid message format: missing data")
			continue
		}

		switch event {
		case "join":
			roomID := data["roomId"].(string)
			name := data["name"].(string)
			userID := data["userId"].(string)
			initialMuted := false
			if m, ok := data["initialMuted"].(bool); ok {
				initialMuted = m
			}
			initialAudioEnabled := true
			if a, ok := data["initialAudioEnabled"].(bool); ok {
				initialAudioEnabled = a
			}

			currentUserID = userID
			currentRoomID = roomID

			// Обновляем состояние пользователя
			s.updateUserVoiceState(userID, map[string]interface{}{
				"channelId":      roomID,
				"userName":       name,
				"isMuted":        initialMuted,
				"isAudioDisabled": !initialAudioEnabled,
			})

			// Генерируем токен для LiveKit
			token, err := s.generateToken(roomID, userID, name)
			if err != nil {
				conn.WriteJSON(map[string]interface{}{
					"event": "error",
					"data":  map[string]string{"error": err.Error()},
				})
				continue
			}

			// Получаем информацию о комнате
			room, err := s.getRoomInfo(roomID)

			existingPeers := []map[string]interface{}{}
			if err == nil && room != nil {
				for _, participant := range room.Participants {
					if participant.Identity != userID {
						userState := s.getUserVoiceState(participant.Identity)
						existingPeers = append(existingPeers, map[string]interface{}{
							"id":                participant.Identity,
							"name":              participant.Name,
							"isMuted":           userState.IsMuted,
							"isAudioEnabled":    !userState.IsAudioDisabled,
							"isGlobalAudioMuted": userState.IsAudioDisabled,
							"userId":            participant.Identity,
						})
					}
				}
			}

			// Отправляем ответ клиенту
			// URL должен быть доступен извне контейнера
			livekitURL := s.config.LiveKitURL
			// Если URL указывает на localhost, заменяем на внешний адрес
			if strings.Contains(livekitURL, "localhost") || strings.Contains(livekitURL, "127.0.0.1") {
				// В продакшене используем домен
				livekitURL = "wss://whithin.ru:7880"
			}
			
			conn.WriteJSON(map[string]interface{}{
				"event": "joined",
				"data": map[string]interface{}{
					"token":          token,
					"url":            livekitURL,
					"existingPeers":  existingPeers,
					"existingProducers": []interface{}{}, // LiveKit управляет этим автоматически
				},
			})

		case "muteState":
			if isMuted, ok := data["isMuted"].(bool); ok {
				s.updateUserVoiceState(currentUserID, map[string]interface{}{
					"isMuted": isMuted,
				})
			}

		case "audioState":
			if isEnabled, ok := data["isEnabled"].(bool); ok {
				s.updateUserVoiceState(currentUserID, map[string]interface{}{
					"isAudioDisabled": !isEnabled,
				})
			}

		case "getVoiceChannelParticipants":
			// Получаем всех участников канала
			participants := s.getChannelParticipants(currentRoomID)
			conn.WriteJSON(map[string]interface{}{
				"event": "voiceChannelParticipantsUpdate",
				"data": map[string]interface{}{
					"channelId":    currentRoomID,
					"participants": participants,
				},
			})

		case "disconnect":
			if currentUserID != "" {
				s.updateUserVoiceState(currentUserID, map[string]interface{}{
					"channelId": "",
				})
			}
			break
		}
	}

	log.Printf("Client disconnected: %s", conn.RemoteAddr())
}

func (s *Server) getChannelParticipants(channelID string) []Participant {
	s.mu.RLock()
	defer s.mu.RUnlock()

	participants := []Participant{}

	// Получаем участников из LiveKit комнаты
	room, err := s.getRoomInfo(channelID)

	if err == nil && room != nil {
		for _, p := range room.Participants {
			userState := s.getUserVoiceState(p.Identity)
			participants = append(participants, Participant{
				UserID:          p.Identity,
				Name:            p.Name,
				IsMuted:         userState.IsMuted,
				IsSpeaking:      false, // LiveKit предоставляет это через события
				IsAudioDisabled: userState.IsAudioDisabled,
				IsActive:         true,
			})
		}
	}

	// Добавляем пользователей, которые в канале, но не в активном соединении
	for userID, state := range s.userVoiceStates {
		if state.ChannelID == channelID {
			// Проверяем, не добавили ли мы уже этого пользователя
			alreadyAdded := false
			for _, p := range participants {
				if p.UserID == userID {
					alreadyAdded = true
					break
				}
			}
			if !alreadyAdded {
				participants = append(participants, Participant{
					UserID:          userID,
					Name:            state.UserName,
					IsMuted:         state.IsMuted,
					IsSpeaking:      false,
					IsAudioDisabled: state.IsAudioDisabled,
					IsActive:        false,
				})
			}
		}
	}

	return participants
}

func (s *Server) setupRoutes() {
	s.mux.HandleFunc("/ws", s.handleWebSocket)
	s.mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", s.config.CORSOrigin)
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	})
}

func main() {
	// Загружаем .env файл
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using environment variables")
	}

	cfg := &Config{
		Port:            getEnv("PORT", "3000"),
		LiveKitURL:      getEnv("LIVEKIT_URL", "ws://localhost:7880"),
		LiveKitAPIKey:   getEnv("LIVEKIT_API_KEY", ""),
		LiveKitAPISecret: getEnv("LIVEKIT_API_SECRET", ""),
		TLSCert:         getEnv("TLS_CERT", "/app/ssl/certificate.crt"),
		TLSKey:          getEnv("TLS_KEY", "/app/ssl/private.key"),
		CORSOrigin:      getEnv("CORS_ORIGIN", "https://whithin.ru"),
	}
	
	// Parse LIVEKIT_KEYS if provided (format: "api_key: api_secret")
	// Приоритет: LIVEKIT_API_KEY/SECRET > LIVEKIT_KEYS
	if cfg.LiveKitAPIKey == "" || cfg.LiveKitAPISecret == "" {
		if keys := os.Getenv("LIVEKIT_KEYS"); keys != "" {
			parts := strings.Split(keys, ":")
			if len(parts) == 2 {
				if cfg.LiveKitAPIKey == "" {
					cfg.LiveKitAPIKey = strings.TrimSpace(parts[0])
				}
				if cfg.LiveKitAPISecret == "" {
					cfg.LiveKitAPISecret = strings.TrimSpace(parts[1])
				}
			}
		}
	}
	
	// Fallback на значения по умолчанию
	if cfg.LiveKitAPIKey == "" {
		cfg.LiveKitAPIKey = "api_key"
	}
	if cfg.LiveKitAPISecret == "" {
		cfg.LiveKitAPISecret = "api_secret"
	}
	
	log.Printf("LiveKit configured: URL=%s, APIKey=%s", cfg.LiveKitURL, cfg.LiveKitAPIKey)

	server, err := NewServer(cfg)
	if err != nil {
		log.Fatalf("Failed to create server: %v", err)
	}

	addr := fmt.Sprintf(":%s", cfg.Port)
	log.Printf("Server starting on %s", addr)
	log.Printf("WebSocket endpoint: ws://localhost%s/ws", addr)

	// Добавляем CORS middleware (но не для WebSocket запросов)
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Для WebSocket запросов не устанавливаем заголовки, т.к. это мешает upgrade
		if !websocket.IsWebSocketUpgrade(r) {
			w.Header().Set("Access-Control-Allow-Origin", cfg.CORSOrigin)
			w.Header().Set("Access-Control-Allow-Credentials", "true")
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, DELETE")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, Upgrade, Connection, Sec-WebSocket-Key, Sec-WebSocket-Version, Sec-WebSocket-Extensions")
			
			if r.Method == "OPTIONS" {
				w.WriteHeader(http.StatusOK)
				return
			}
		}
		
		server.mux.ServeHTTP(w, r)
	})

	// Проверяем наличие SSL сертификатов
	if _, err := os.Stat(cfg.TLSCert); err == nil {
		if _, err := os.Stat(cfg.TLSKey); err == nil {
			log.Println("Starting HTTPS server")
			if err := http.ListenAndServeTLS(addr, cfg.TLSCert, cfg.TLSKey, handler); err != nil {
				log.Fatalf("Server failed: %v", err)
			}
		}
	}

	log.Println("Starting HTTP server")
	if err := http.ListenAndServe(addr, handler); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

