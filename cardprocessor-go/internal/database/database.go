package database

import (
	"database/sql"
	"fmt"
	"log"
	"time"

	"cardprocessor-go/internal/config"

	_ "github.com/lib/pq"
)

// DB holds the database connection
type DB struct {
	*sql.DB
}

// NewConnection creates a new database connection
func NewConnection(cfg *config.Config) (*DB, error) {
	dsn := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=%s",
		cfg.Database.Host,
		cfg.Database.Port,
		cfg.Database.User,
		cfg.Database.Password,
		cfg.Database.Name,
		cfg.Database.SSLMode,
	)

	db, err := sql.Open("postgres", dsn)
	if err != nil {
		return nil, fmt.Errorf("failed to open database connection: %w", err)
	}

	// Configure connection pool
	db.SetMaxOpenConns(cfg.Database.MaxOpenConns)
	db.SetMaxIdleConns(cfg.Database.MaxIdleConns)
	db.SetConnMaxLifetime(time.Duration(cfg.Database.ConnMaxLifetime) * time.Minute)

	// Test the connection
	if err := db.Ping(); err != nil {
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	log.Printf("Successfully connected to database: %s", cfg.Database.Name)

	return &DB{db}, nil
}

// Close closes the database connection
func (db *DB) Close() error {
	return db.DB.Close()
}

// Health checks if the database connection is healthy
func (db *DB) Health() error {
	return db.Ping()
}
