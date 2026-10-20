package outbox

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"log"
	"net/http"
	"strconv"
	"time"

	"github.com/Mug1vara97/Whithin-messenger/bot-service/internal/store"
)

type Worker struct {
	store  *store.Store
	client *http.Client
}

func New(s *store.Store) *Worker {
	return &Worker{
		store:  s,
		client: &http.Client{Timeout: 10 * time.Second},
	}
}

func (w *Worker) Run(ctx context.Context) {
	ticker := time.NewTicker(2 * time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			w.tick(ctx)
		}
	}
}

func (w *Worker) tick(ctx context.Context) {
	updates, err := w.store.ClaimPendingWebhookUpdates(ctx, 20)
	if err != nil {
		log.Printf("outbox claim: %v", err)
		return
	}
	for _, u := range updates {
		wh, err := w.store.GetWebhook(ctx, u.BotID)
		if err != nil {
			continue
		}
		if err := w.deliver(ctx, wh, u); err != nil {
			log.Printf("outbox deliver %d: %v", u.ID, err)
			continue
		}
		_ = w.store.MarkUpdateDelivered(ctx, u.ID)
	}
}

func (w *Worker) deliver(ctx context.Context, wh store.Webhook, u store.Update) error {
	ts := strconv.FormatInt(time.Now().Unix(), 10)
	mac := hmac.New(sha256.New, []byte(wh.Secret))
	mac.Write([]byte(ts))
	mac.Write([]byte("."))
	mac.Write(u.Payload)
	sig := hex.EncodeToString(mac.Sum(nil))

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, wh.URL, bytes.NewReader(u.Payload))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Whithin-Timestamp", ts)
	req.Header.Set("X-Whithin-Signature", sig)
	resp, err := w.client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		return errStatus(resp.StatusCode)
	}
	return nil
}

type statusErr int

func (e statusErr) Error() string { return "webhook status " + strconv.Itoa(int(e)) }
func errStatus(code int) error    { return statusErr(code) }
