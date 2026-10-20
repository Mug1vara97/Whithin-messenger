package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/google/uuid"

	"github.com/Mug1vara97/Whithin-messenger/bot-service/internal/auth"
	"github.com/Mug1vara97/Whithin-messenger/bot-service/internal/config"
	"github.com/Mug1vara97/Whithin-messenger/bot-service/internal/coreclient"
	"github.com/Mug1vara97/Whithin-messenger/bot-service/internal/store"
)

type Server struct {
	cfg  config.Config
	db   *store.Store
	core *coreclient.Client
}

func New(cfg config.Config, db *store.Store, core *coreclient.Client) http.Handler {
	s := &Server{cfg: cfg, db: db, core: core}
	r := chi.NewRouter()
	r.Use(middleware.RequestID, middleware.RealIP, middleware.Logger, middleware.Recoverer)

	r.Get("/health", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})

	r.Route("/api/bot/v1", func(r chi.Router) {
		r.Get("/getMe", s.withBot(s.getMe))
		r.Post("/sendMessage", s.withBot(s.sendMessage))
		r.Get("/getUpdates", s.withBot(s.getUpdates))
		r.Post("/setWebhook", s.withBot(s.setWebhook))
		r.Post("/deleteWebhook", s.withBot(s.deleteWebhook))
		r.Get("/getWebhookInfo", s.withBot(s.getWebhookInfo))
	})

	r.Route("/api/bot/developer", func(r chi.Router) {
		r.Post("/applications", s.withUser(s.createApplication))
		r.Get("/applications", s.withUser(s.listApplications))
		r.Post("/applications/{appId}/bots", s.withUser(s.createBot))
		r.Get("/applications/{appId}/bots", s.withUser(s.listBots))
		r.Post("/bots/{botId}/token", s.withUser(s.rotateToken))
		r.Post("/bots/{botId}/install", s.withUser(s.installBot))
		r.Post("/bots/{botId}/webhook", s.withUser(s.devSetWebhook))
	})

	r.Post("/internal/v1/events", s.internalEvent)
	return r
}

type botHandler func(w http.ResponseWriter, r *http.Request, bot store.Bot)
type userHandler func(w http.ResponseWriter, r *http.Request, user auth.UserClaims)

func (s *Server) withBot(next botHandler) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		plain, err := auth.ParseBotToken(r)
		if err != nil {
			writeErr(w, http.StatusUnauthorized, "bot token required")
			return
		}
		bot, err := s.db.FindBotByTokenHash(r.Context(), auth.HashToken(plain))
		if err != nil {
			writeErr(w, http.StatusUnauthorized, "invalid bot token")
			return
		}
		next(w, r, bot)
	}
}

func (s *Server) withUser(next userHandler) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		user, err := auth.ParseUserJWT(r, s.cfg.JWTIssuer, s.cfg.JWTAudience, s.cfg.JWTKey)
		if err != nil {
			writeErr(w, http.StatusUnauthorized, "user jwt required")
			return
		}
		next(w, r, user)
	}
}

func (s *Server) getMe(w http.ResponseWriter, r *http.Request, bot store.Bot) {
	writeJSON(w, http.StatusOK, map[string]any{
		"ok": true,
		"result": map[string]any{
			"id":          bot.UserID,
			"botId":       bot.ID,
			"is_bot":      true,
			"username":    bot.Username,
			"displayName": bot.DisplayName,
		},
	})
}

func (s *Server) sendMessage(w http.ResponseWriter, r *http.Request, bot store.Bot) {
	var body struct {
		ChatID           uuid.UUID  `json:"chat_id"`
		Text             string     `json:"text"`
		ReplyToMessageID *uuid.UUID `json:"reply_to_message_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid json")
		return
	}
	if body.ChatID == uuid.Nil || strings.TrimSpace(body.Text) == "" {
		writeErr(w, http.StatusBadRequest, "chat_id and text required")
		return
	}
	res, err := s.core.SendMessage(r.Context(), body.ChatID, bot.UserID, body.Text, body.ReplyToMessageID)
	if err != nil {
		writeErr(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"ok": true,
		"result": map[string]any{
			"message_id": res.MessageID,
			"chat":       map[string]any{"id": res.ChatID},
			"text":       body.Text,
			"from":       map[string]any{"id": bot.UserID, "is_bot": true, "username": bot.Username},
		},
	})
}

func (s *Server) getUpdates(w http.ResponseWriter, r *http.Request, bot store.Bot) {
	// Telegram-style: offset is the first update_id to return (last_update_id + 1).
	offset, _ := strconv.ParseInt(r.URL.Query().Get("offset"), 10, 64)
	if offset > 0 {
		offset = offset - 1
	}
	timeout, _ := strconv.Atoi(r.URL.Query().Get("timeout"))
	if timeout < 0 {
		timeout = 0
	}
	if timeout > 50 {
		timeout = 50
	}
	limit := 100

	deadline := time.Now().Add(time.Duration(timeout) * time.Second)
	for {
		updates, err := s.db.GetUpdates(r.Context(), bot.ID, offset, limit)
		if err != nil {
			writeErr(w, http.StatusInternalServerError, err.Error())
			return
		}
		if len(updates) > 0 || timeout == 0 || time.Now().After(deadline) {
			out := make([]map[string]any, 0, len(updates))
			var maxID int64
			for _, u := range updates {
				var payload any
				_ = json.Unmarshal(u.Payload, &payload)
				out = append(out, map[string]any{"update_id": u.ID, "payload": payload})
				if u.ID > maxID {
					maxID = u.ID
				}
			}
			if maxID > 0 {
				_ = s.db.MarkUpdatesDelivered(r.Context(), bot.ID, maxID)
			}
			writeJSON(w, http.StatusOK, map[string]any{"ok": true, "result": out})
			return
		}
		select {
		case <-r.Context().Done():
			writeJSON(w, http.StatusOK, map[string]any{"ok": true, "result": []any{}})
			return
		case <-time.After(1 * time.Second):
		}
	}
}

func (s *Server) setWebhook(w http.ResponseWriter, r *http.Request, bot store.Bot) {
	var body struct {
		URL string `json:"url"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || strings.TrimSpace(body.URL) == "" {
		writeErr(w, http.StatusBadRequest, "url required")
		return
	}
	secret := uuid.NewString()
	if err := s.db.SetWebhook(r.Context(), bot.ID, body.URL, secret); err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "result": true, "secret": secret})
}

func (s *Server) deleteWebhook(w http.ResponseWriter, r *http.Request, bot store.Bot) {
	_ = s.db.DeleteWebhook(r.Context(), bot.ID)
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "result": true})
}

func (s *Server) getWebhookInfo(w http.ResponseWriter, r *http.Request, bot store.Bot) {
	wh, err := s.db.GetWebhook(r.Context(), bot.ID)
	if errors.Is(err, store.ErrNotFound) {
		writeJSON(w, http.StatusOK, map[string]any{"ok": true, "result": map[string]any{"url": "", "enabled": false}})
		return
	}
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"ok": true,
		"result": map[string]any{"url": wh.URL, "enabled": wh.Enabled},
	})
}

func (s *Server) createApplication(w http.ResponseWriter, r *http.Request, user auth.UserClaims) {
	var body struct {
		Name string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || strings.TrimSpace(body.Name) == "" {
		writeErr(w, http.StatusBadRequest, "name required")
		return
	}
	app, err := s.db.CreateApplication(r.Context(), user.UserID, strings.TrimSpace(body.Name))
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, app)
}

func (s *Server) listApplications(w http.ResponseWriter, r *http.Request, user auth.UserClaims) {
	apps, err := s.db.ListApplications(r.Context(), user.UserID)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, apps)
}

func (s *Server) createBot(w http.ResponseWriter, r *http.Request, user auth.UserClaims) {
	appID, err := uuid.Parse(chi.URLParam(r, "appId"))
	if err != nil {
		writeErr(w, http.StatusBadRequest, "invalid app id")
		return
	}
	app, err := s.db.GetApplication(r.Context(), appID)
	if err != nil || app.OwnerUserID != user.UserID {
		writeErr(w, http.StatusForbidden, "application not found")
		return
	}
	var body struct {
		Username    string  `json:"username"`
		DisplayName *string `json:"displayName"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || strings.TrimSpace(body.Username) == "" {
		writeErr(w, http.StatusBadRequest, "username required")
		return
	}
	coreUser, err := s.core.CreateBotUser(r.Context(), strings.TrimSpace(body.Username), body.DisplayName)
	if err != nil {
		writeErr(w, http.StatusBadRequest, err.Error())
		return
	}
	bot, err := s.db.CreateBot(r.Context(), appID, coreUser.UserID, coreUser.Username, coreUser.DisplayName)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	plain, hash, prefix, err := auth.NewBotToken()
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	if err := s.db.InsertToken(r.Context(), bot.ID, hash, prefix); err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"bot":   bot,
		"token": plain,
	})
}

func (s *Server) listBots(w http.ResponseWriter, r *http.Request, user auth.UserClaims) {
	appID, err := uuid.Parse(chi.URLParam(r, "appId"))
	if err != nil {
		writeErr(w, http.StatusBadRequest, "invalid app id")
		return
	}
	app, err := s.db.GetApplication(r.Context(), appID)
	if err != nil || app.OwnerUserID != user.UserID {
		writeErr(w, http.StatusForbidden, "application not found")
		return
	}
	bots, err := s.db.ListBotsByApplication(r.Context(), appID)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, bots)
}

func (s *Server) rotateToken(w http.ResponseWriter, r *http.Request, user auth.UserClaims) {
	botID, err := uuid.Parse(chi.URLParam(r, "botId"))
	if err != nil {
		writeErr(w, http.StatusBadRequest, "invalid bot id")
		return
	}
	if !s.ownsBot(r.Context(), user.UserID, botID) {
		writeErr(w, http.StatusForbidden, "forbidden")
		return
	}
	plain, hash, prefix, err := auth.NewBotToken()
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	if err := s.db.InsertToken(r.Context(), botID, hash, prefix); err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"token": plain})
}

func (s *Server) installBot(w http.ResponseWriter, r *http.Request, user auth.UserClaims) {
	botID, err := uuid.Parse(chi.URLParam(r, "botId"))
	if err != nil {
		writeErr(w, http.StatusBadRequest, "invalid bot id")
		return
	}
	bot, err := s.db.GetBot(r.Context(), botID)
	if err != nil {
		writeErr(w, http.StatusNotFound, "bot not found")
		return
	}
	app, err := s.db.GetApplication(r.Context(), bot.ApplicationID)
	if err != nil || app.OwnerUserID != user.UserID {
		writeErr(w, http.StatusForbidden, "forbidden")
		return
	}
	var body struct {
		ServerID    uuid.UUID `json:"serverId"`
		Permissions int64     `json:"permissions"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.ServerID == uuid.Nil {
		writeErr(w, http.StatusBadRequest, "serverId required")
		return
	}
	if err := s.core.InstallBot(r.Context(), body.ServerID, bot.UserID, user.UserID); err != nil {
		writeErr(w, http.StatusBadRequest, err.Error())
		return
	}
	if err := s.db.UpsertInstall(r.Context(), bot.ID, body.ServerID, user.UserID, body.Permissions); err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (s *Server) devSetWebhook(w http.ResponseWriter, r *http.Request, user auth.UserClaims) {
	botID, err := uuid.Parse(chi.URLParam(r, "botId"))
	if err != nil || !s.ownsBot(r.Context(), user.UserID, botID) {
		writeErr(w, http.StatusForbidden, "forbidden")
		return
	}
	s.setWebhook(w, r, store.Bot{ID: botID})
}

func (s *Server) ownsBot(ctx context.Context, ownerID, botID uuid.UUID) bool {
	bot, err := s.db.GetBot(ctx, botID)
	if err != nil {
		return false
	}
	app, err := s.db.GetApplication(ctx, bot.ApplicationID)
	return err == nil && app.OwnerUserID == ownerID
}

func (s *Server) internalEvent(w http.ResponseWriter, r *http.Request) {
	if !auth.RequireInternalKey(r, s.cfg.InternalAPIKey) {
		writeErr(w, http.StatusUnauthorized, "invalid internal key")
		return
	}
	raw, err := io.ReadAll(r.Body)
	if err != nil {
		writeErr(w, http.StatusBadRequest, "read body")
		return
	}
	var envelope struct {
		Type    string          `json:"type"`
		Payload json.RawMessage `json:"payload"`
	}
	if err := json.Unmarshal(raw, &envelope); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid json")
		return
	}

	var meta struct {
		ChatID         uuid.UUID `json:"chatId"`
		MessageID      uuid.UUID `json:"messageId"`
		SenderID       uuid.UUID `json:"senderId"`
		Content        string    `json:"content"`
		SenderUsername string    `json:"senderUsername"`
		Date           int64     `json:"date"`
		ServerID       uuid.UUID `json:"serverId"`
		ServerName     string    `json:"serverName"`
		UserID         uuid.UUID `json:"userId"`
		Username       string    `json:"username"`
	}
	_ = json.Unmarshal(envelope.Payload, &meta)

	targets := []uuid.UUID{}
	if meta.ServerID != uuid.Nil {
		targets, _ = s.db.ListInstalledBotIDsForServer(r.Context(), meta.ServerID)
	} else {
		// No server id on message event yet — fan out to all bots (MVP).
		targets, _ = s.db.ListAllBotIDs(r.Context())
	}

	var updateBody []byte
	switch envelope.Type {
	case "member.joined":
		updateBody, _ = json.Marshal(map[string]any{
			"type": "member.joined",
			"member": map[string]any{
				"id":       meta.UserID,
				"username": meta.Username,
			},
			"server": map[string]any{
				"id":   meta.ServerID,
				"name": meta.ServerName,
			},
			"date": meta.Date,
		})
	default:
		updateBody, _ = json.Marshal(map[string]any{
			"type": envelope.Type,
			"message": map[string]any{
				"message_id": meta.MessageID,
				"chat":       map[string]any{"id": meta.ChatID},
				"from": map[string]any{
					"id":       meta.SenderID,
					"username": meta.SenderUsername,
				},
				"text": meta.Content,
				"date": meta.Date,
			},
		})
	}

	for _, botID := range targets {
		bot, err := s.db.GetBot(r.Context(), botID)
		if err != nil {
			continue
		}
		// Don't echo the bot's own messages into its update stream.
		if envelope.Type != "member.joined" && bot.UserID == meta.SenderID {
			continue
		}
		_, _ = s.db.EnqueueUpdate(r.Context(), botID, updateBody)
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeErr(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]any{"ok": false, "error": msg})
}
