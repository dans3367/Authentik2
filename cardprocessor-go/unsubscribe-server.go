package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"syscall"

	"cardprocessor-go/internal/config"
	"cardprocessor-go/internal/database"
	"cardprocessor-go/internal/handlers"
	"cardprocessor-go/internal/repository"

	"github.com/gin-gonic/gin"
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

	// Set Gin mode based on environment
	if cfg.Server.Environment == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	// Initialize Gin router
	router := gin.New()

	// Load HTML templates
	router.LoadHTMLGlob("cardprocessor-go/templates/*")

	// Add middleware
	router.Use(gin.Logger())
	router.Use(gin.Recovery())

	// CORS middleware - allow all origins for unsubscribe pages
	router.Use(func(c *gin.Context) {
		c.Header("Access-Control-Allow-Origin", "*")
		c.Header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Content-Type, Authorization")
		
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}
		
		c.Next()
	})

	// Create birthday handler
	birthdayHandler := handlers.NewBirthdayHandler(repo, nil, cfg)

	// Health check endpoint
	router.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"status":  "ok",
			"service": "unsubscribe-server",
			"version": "1.0.0",
			"port":    "7070",
		})
	})

	// Public unsubscribe routes (no authentication required)
	router.GET("/api/unsubscribe/birthday", birthdayHandler.ShowBirthdayUnsubscribePage)
	router.POST("/api/unsubscribe/birthday", birthdayHandler.ProcessBirthdayUnsubscribe)

	// Handle shutdown signals
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

	// Start server in goroutine
	go func() {
		port := "7070"
		log.Printf("🚀 Unsubscribe Server starting on port %s", port)
		if err := router.Run(":" + port); err != nil {
			log.Fatalf("Failed to start unsubscribe server: %v", err)
		}
	}()

	// Wait for shutdown signal
	<-sigChan
	log.Println("🛑 Unsubscribe Server shutting down...")

	// Graceful shutdown
	ctx, cancel := context.WithTimeout(context.Background(), 5)
	defer cancel()
	_ = ctx

	log.Println("✅ Unsubscribe Server stopped")
	os.Exit(0)
}