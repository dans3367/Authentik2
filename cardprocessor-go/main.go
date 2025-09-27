package main

import (
	"log"

	"cardprocessor-go/internal/config"
	"cardprocessor-go/internal/database"
	"cardprocessor-go/internal/repository"
	"cardprocessor-go/internal/router"

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

	// TODO: Initialize birthday worker
	// worker := worker.NewBirthdayWorker(db, cfg)
	// go worker.Start()

	// Initialize and start server
	router := router.SetupRouter(cfg, repo)

	log.Printf("Starting server on port %s", cfg.Server.Port)
	if err := router.Run(":" + cfg.Server.Port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
