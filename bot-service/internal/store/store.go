package store

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var ErrNotFound = errors.New("not found")

type Store struct {
	pool *pgxpool.Pool
}

func New(ctx context.Context, databaseURL string) (*Store, error) {
	pool, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		return nil, err
	}
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, err
	}
	return &Store{pool: pool}, nil
}

func (s *Store) Close() { s.pool.Close() }

func (s *Store) Pool() *pgxpool.Pool { return s.pool }

type Application struct {
	ID          uuid.UUID `json:"id"`
	OwnerUserID uuid.UUID `json:"ownerUserId"`
	Name        string    `json:"name"`
	Icon        *string   `json:"icon,omitempty"`
	CreatedAt   time.Time `json:"createdAt"`
}

type Bot struct {
	ID            uuid.UUID `json:"id"`
	ApplicationID uuid.UUID `json:"applicationId"`
	UserID        uuid.UUID `json:"userId"`
	Username      string    `json:"username"`
	DisplayName   *string   `json:"displayName,omitempty"`
	Intents       int       `json:"intents"`
	CreatedAt     time.Time `json:"createdAt"`
}

type TokenRow struct {
	ID          uuid.UUID
	BotID       uuid.UUID
	TokenHash   string
	TokenPrefix string
	RevokedAt   *time.Time
}

type Webhook struct {
	BotID   uuid.UUID
	URL     string
	Secret  string
	Enabled bool
}

type Update struct {
	ID      int64
	BotID   uuid.UUID
	Payload json.RawMessage
}

func (s *Store) CreateApplication(ctx context.Context, ownerID uuid.UUID, name string) (Application, error) {
	app := Application{
		ID:          uuid.New(),
		OwnerUserID: ownerID,
		Name:        name,
		CreatedAt:   time.Now().UTC(),
	}
	_, err := s.pool.Exec(ctx,
		`INSERT INTO bot_applications (id, owner_user_id, name, created_at) VALUES ($1,$2,$3,$4)`,
		app.ID, app.OwnerUserID, app.Name, app.CreatedAt)
	return app, err
}

func (s *Store) ListApplications(ctx context.Context, ownerID uuid.UUID) ([]Application, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT id, owner_user_id, name, icon, created_at FROM bot_applications WHERE owner_user_id=$1 ORDER BY created_at DESC`,
		ownerID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Application
	for rows.Next() {
		var a Application
		if err := rows.Scan(&a.ID, &a.OwnerUserID, &a.Name, &a.Icon, &a.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, a)
	}
	return out, rows.Err()
}

func (s *Store) GetApplication(ctx context.Context, id uuid.UUID) (Application, error) {
	var a Application
	err := s.pool.QueryRow(ctx,
		`SELECT id, owner_user_id, name, icon, created_at FROM bot_applications WHERE id=$1`, id).
		Scan(&a.ID, &a.OwnerUserID, &a.Name, &a.Icon, &a.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return a, ErrNotFound
	}
	return a, err
}

func (s *Store) CreateBot(ctx context.Context, appID, userID uuid.UUID, username string, displayName *string) (Bot, error) {
	bot := Bot{
		ID:            uuid.New(),
		ApplicationID: appID,
		UserID:        userID,
		Username:      username,
		DisplayName:   displayName,
		CreatedAt:     time.Now().UTC(),
	}
	_, err := s.pool.Exec(ctx,
		`INSERT INTO bot_bots (id, application_id, user_id, username, display_name, intents, created_at)
		 VALUES ($1,$2,$3,$4,$5,0,$6)`,
		bot.ID, bot.ApplicationID, bot.UserID, bot.Username, bot.DisplayName, bot.CreatedAt)
	return bot, err
}

func (s *Store) GetBot(ctx context.Context, id uuid.UUID) (Bot, error) {
	var b Bot
	err := s.pool.QueryRow(ctx,
		`SELECT id, application_id, user_id, username, display_name, intents, created_at FROM bot_bots WHERE id=$1`, id).
		Scan(&b.ID, &b.ApplicationID, &b.UserID, &b.Username, &b.DisplayName, &b.Intents, &b.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return b, ErrNotFound
	}
	return b, err
}

func (s *Store) GetBotByUserID(ctx context.Context, userID uuid.UUID) (Bot, error) {
	var b Bot
	err := s.pool.QueryRow(ctx,
		`SELECT id, application_id, user_id, username, display_name, intents, created_at FROM bot_bots WHERE user_id=$1`, userID).
		Scan(&b.ID, &b.ApplicationID, &b.UserID, &b.Username, &b.DisplayName, &b.Intents, &b.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return b, ErrNotFound
	}
	return b, err
}

func (s *Store) ListBotsByApplication(ctx context.Context, appID uuid.UUID) ([]Bot, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT id, application_id, user_id, username, display_name, intents, created_at FROM bot_bots WHERE application_id=$1`,
		appID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Bot
	for rows.Next() {
		var b Bot
		if err := rows.Scan(&b.ID, &b.ApplicationID, &b.UserID, &b.Username, &b.DisplayName, &b.Intents, &b.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, b)
	}
	return out, rows.Err()
}

func (s *Store) InsertToken(ctx context.Context, botID uuid.UUID, hash, prefix string) error {
	_, err := s.pool.Exec(ctx,
		`INSERT INTO bot_tokens (id, bot_id, token_hash, token_prefix, created_at) VALUES ($1,$2,$3,$4,NOW())`,
		uuid.New(), botID, hash, prefix)
	return err
}

func (s *Store) FindBotByTokenHash(ctx context.Context, hash string) (Bot, error) {
	var b Bot
	err := s.pool.QueryRow(ctx, `
		SELECT b.id, b.application_id, b.user_id, b.username, b.display_name, b.intents, b.created_at
		FROM bot_tokens t
		JOIN bot_bots b ON b.id = t.bot_id
		WHERE t.token_hash=$1 AND t.revoked_at IS NULL`, hash).
		Scan(&b.ID, &b.ApplicationID, &b.UserID, &b.Username, &b.DisplayName, &b.Intents, &b.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return b, ErrNotFound
	}
	return b, err
}

func (s *Store) UpsertInstall(ctx context.Context, botID, serverID, installedBy uuid.UUID, permissions int64) error {
	_, err := s.pool.Exec(ctx, `
		INSERT INTO bot_installs (id, bot_id, server_id, permissions, installed_by, installed_at)
		VALUES ($1,$2,$3,$4,$5,NOW())
		ON CONFLICT (bot_id, server_id) DO UPDATE SET permissions=EXCLUDED.permissions, installed_by=EXCLUDED.installed_by`,
		uuid.New(), botID, serverID, permissions, installedBy)
	return err
}

func (s *Store) ListInstalledBotIDsForServer(ctx context.Context, serverID uuid.UUID) ([]uuid.UUID, error) {
	rows, err := s.pool.Query(ctx, `SELECT bot_id FROM bot_installs WHERE server_id=$1`, serverID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []uuid.UUID
	for rows.Next() {
		var id uuid.UUID
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		out = append(out, id)
	}
	return out, rows.Err()
}

func (s *Store) ListAllBotIDs(ctx context.Context) ([]uuid.UUID, error) {
	rows, err := s.pool.Query(ctx, `SELECT id FROM bot_bots`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []uuid.UUID
	for rows.Next() {
		var id uuid.UUID
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		out = append(out, id)
	}
	return out, rows.Err()
}

func (s *Store) SetWebhook(ctx context.Context, botID uuid.UUID, url, secret string) error {
	_, err := s.pool.Exec(ctx, `
		INSERT INTO bot_webhooks (bot_id, url, secret, enabled, updated_at)
		VALUES ($1,$2,$3,TRUE,NOW())
		ON CONFLICT (bot_id) DO UPDATE SET url=EXCLUDED.url, secret=EXCLUDED.secret, enabled=TRUE, updated_at=NOW()`,
		botID, url, secret)
	return err
}

func (s *Store) DeleteWebhook(ctx context.Context, botID uuid.UUID) error {
	_, err := s.pool.Exec(ctx, `DELETE FROM bot_webhooks WHERE bot_id=$1`, botID)
	return err
}

func (s *Store) GetWebhook(ctx context.Context, botID uuid.UUID) (Webhook, error) {
	var w Webhook
	err := s.pool.QueryRow(ctx,
		`SELECT bot_id, url, secret, enabled FROM bot_webhooks WHERE bot_id=$1`, botID).
		Scan(&w.BotID, &w.URL, &w.Secret, &w.Enabled)
	if errors.Is(err, pgx.ErrNoRows) {
		return w, ErrNotFound
	}
	return w, err
}

func (s *Store) EnqueueUpdate(ctx context.Context, botID uuid.UUID, payload []byte) (int64, error) {
	var id int64
	err := s.pool.QueryRow(ctx,
		`INSERT INTO bot_updates (bot_id, payload) VALUES ($1,$2::jsonb) RETURNING id`,
		botID, payload).Scan(&id)
	return id, err
}

func (s *Store) GetUpdates(ctx context.Context, botID uuid.UUID, offset int64, limit int) ([]Update, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT id, bot_id, payload FROM bot_updates
		WHERE bot_id=$1 AND id > $2
		ORDER BY id ASC LIMIT $3`, botID, offset, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Update
	for rows.Next() {
		var u Update
		if err := rows.Scan(&u.ID, &u.BotID, &u.Payload); err != nil {
			return nil, err
		}
		out = append(out, u)
	}
	return out, rows.Err()
}

func (s *Store) MarkUpdatesDelivered(ctx context.Context, botID uuid.UUID, maxID int64) error {
	_, err := s.pool.Exec(ctx,
		`UPDATE bot_updates SET delivered_at=NOW() WHERE bot_id=$1 AND id<=$2 AND delivered_at IS NULL`,
		botID, maxID)
	return err
}

func (s *Store) ClaimPendingWebhookUpdates(ctx context.Context, limit int) ([]Update, error) {
	rows, err := s.pool.Query(ctx, `
		WITH cte AS (
			SELECT u.id
			FROM bot_updates u
			JOIN bot_webhooks w ON w.bot_id = u.bot_id AND w.enabled = TRUE
			WHERE u.delivered_at IS NULL
			ORDER BY u.id ASC
			LIMIT $1
			FOR UPDATE SKIP LOCKED
		)
		UPDATE bot_updates u SET poll_claimed_at=NOW()
		FROM cte WHERE u.id = cte.id
		RETURNING u.id, u.bot_id, u.payload`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Update
	for rows.Next() {
		var u Update
		if err := rows.Scan(&u.ID, &u.BotID, &u.Payload); err != nil {
			return nil, err
		}
		out = append(out, u)
	}
	return out, rows.Err()
}

func (s *Store) MarkUpdateDelivered(ctx context.Context, id int64) error {
	_, err := s.pool.Exec(ctx, `UPDATE bot_updates SET delivered_at=NOW() WHERE id=$1`, id)
	return err
}
