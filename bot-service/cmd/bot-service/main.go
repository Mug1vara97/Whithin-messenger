package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"syscall"
	"time"

	"github.com/Mug1vara97/Whithin-messenger/bot-service/internal/config"
	"github.com/Mug1vara97/Whithin-messenger/bot-service/internal/coreclient"
	"github.com/Mug1vara97/Whithin-messenger/bot-service/internal/httpapi"
	"github.com/Mug1vara97/Whithin-messenger/bot-service/internal/outbox"
	"github.com/Mug1vara97/Whithin-messenger/bot-service/internal/store"
)

func main() {
	cfg := config.Load()
	ctx, cancel := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer cancel()

	db, err := store.New(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("db: %v", err)
	}
	defer db.Close()

	if err := runMigrations(ctx, db, "migrations"); err != nil {
		log.Fatalf("migrate: %v", err)
	}

	core := coreclient.New(cfg.CoreAPIBaseURL, cfg.InternalAPIKey)
	handler := httpapi.New(cfg, db, core)
	worker := outbox.New(db)
	go worker.Run(ctx)

	srv := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           handler,
		ReadHeaderTimeout: 10 * time.Second,
	}

	go func() {
		log.Printf("bot-service listening on :%s", cfg.Port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("listen: %v", err)
		}
	}()

	<-ctx.Done()
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutdownCancel()
	_ = srv.Shutdown(shutdownCtx)
}

func runMigrations(ctx context.Context, db *store.Store, dir string) error {
	entries, err := os.ReadDir(dir)
	if err != nil {
		// try relative to executable / cwd fallbacks
		candidates := []string{dir, filepath.Join(".", "migrations"), "/app/migrations"}
		for _, c := range candidates {
			entries, err = os.ReadDir(c)
			if err == nil {
				dir = c
				break
			}
		}
		if err != nil {
			return err
		}
	}
	for _, e := range entries {
		if e.IsDir() || !strings.HasSuffix(e.Name(), ".sql") {
			continue
		}
		raw, err := os.ReadFile(filepath.Join(dir, e.Name()))
		if err != nil {
			return err
		}
		if _, err := db.Pool().Exec(ctx, string(raw)); err != nil {
			return err
		}
		log.Printf("applied migration %s", e.Name())
	}
	return nil
}
