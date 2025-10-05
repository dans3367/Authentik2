package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"strings"
	"syscall"

	"cardprocessor-go/internal/config"
	"cardprocessor-go/internal/database"
	"cardprocessor-go/internal/repository"
	"cardprocessor-go/internal/router"
	"cardprocessor-go/internal/temporal"

	"github.com/joho/godotenv"
)

func main() {
	// Load environment variables
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using system environment variables")
	}

	// Load configuration
	cfg := config.Load()

	// Initialize database
	db, err := database.NewConnection(cfg)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer db.Close()

	// Initialize repository
	repo := repository.NewRepository(db)

	// Initialize Temporal worker if enabled
	var temporalClient *temporal.TemporalClient
	if cfg.TemporalWorkerEnabled {
		temporalClient, err = temporal.NewTemporalClient(cfg)
		if err != nil {
			log.Printf("⚠️ Failed to initialize Temporal client: %v", err)
			log.Println("Continuing without Temporal worker...")
		} else {
			// Set activity dependencies
			temporal.SetActivityDependencies(cfg, repo)

			// Start Temporal worker in a goroutine
			go func() {
				ctx := context.Background()
				if err := temporalClient.Start(ctx); err != nil {
					log.Printf("❌ Temporal worker failed: %v", err)
				}
			}()
			log.Println("✅ Temporal worker started")
		}
	} else {
		log.Println("ℹ️ Temporal worker is disabled")
	}

	// Initialize and start server
	apiRouter := router.SetupRouter(cfg, repo, temporalClient)

	// Initialize and start separate webhook server on its own port
	webhookRouter := router.SetupWebhookRouter(cfg, repo)
	go func() {
		// Sanitize WEBHOOK_PORT in case it was set like "=5006" or ":5006"
		port := strings.TrimSpace(cfg.WebhookPort)
		port = strings.TrimLeft(port, ":=")
		if port == "" {
			port = "5006"
		}
		log.Printf("ð Starting webhook server on port %s", port)
		if err := webhookRouter.Run(":" + port); err != nil {
			log.Printf("Webhook server stopped: %v", err)
		}
	}()

	// Handle shutdown signals
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		<-sigChan
		log.Println("🛑 Shutdown signal received...")

		// Stop Temporal worker
		if temporalClient != nil {
			temporalClient.Stop()
		}

		os.Exit(0)
	}()

	log.Printf("🚀 Starting API server on port %s", cfg.Port)
	if err := apiRouter.Run(":" + cfg.Port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
