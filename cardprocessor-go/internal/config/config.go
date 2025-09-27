package config

import (
	"os"
	"strconv"
	"strings"
)

type Config struct {
	// Database
	DatabaseURL string
	Database    DatabaseConfig

	// Server
	Port    string
	GinMode string
	Server  ServerConfig

	// JWT
	JWTSecret string
	JWT       JWTConfig

	// Email providers
	SendGridAPIKey string
	MailgunAPIKey  string
	MailgunDomain  string
	ResendAPIKey   string

	// Default email settings
	DefaultFromEmail string
	DefaultFromName  string

	// Birthday worker settings
	BirthdayCheckInterval int // in seconds
	BirthdayBatchSize     int
	BirthdayMaxRetries    int
	BirthdayRetryDelay    int // in seconds
	BirthdayWorkerEnabled bool

	// Logging
	LogLevel string

	// CORS
	CORSAllowedOrigins []string
	CORS               CORSConfig
}

type DatabaseConfig struct {
	Host            string
	Port            string
	User            string
	Password        string
	Name            string
	SSLMode         string
	MaxOpenConns    int
	MaxIdleConns    int
	ConnMaxLifetime int
}

type ServerConfig struct {
	Port        string
	Environment string
}

type JWTConfig struct {
	Secret string
}

type CORSConfig struct {
	AllowedOrigins   []string
	AllowedMethods   []string
	AllowedHeaders   []string
	AllowCredentials bool
}

func Load() *Config {
	return &Config{
		// Database
		DatabaseURL: getEnv("DATABASE_URL", "postgres://localhost:5432/authentik_db?sslmode=disable"),
		Database: DatabaseConfig{
			Host:            getEnv("DB_HOST", "localhost"),
			Port:            getEnv("DB_PORT", "5432"),
			User:            getEnv("DB_USER", "postgres"),
			Password:        getEnv("DB_PASSWORD", ""),
			Name:            getEnv("DB_NAME", "authentik_db"),
			SSLMode:         getEnv("DB_SSLMODE", "disable"),
			MaxOpenConns:    getEnvAsInt("DB_MAX_OPEN_CONNS", 25),
			MaxIdleConns:    getEnvAsInt("DB_MAX_IDLE_CONNS", 25),
			ConnMaxLifetime: getEnvAsInt("DB_CONN_MAX_LIFETIME", 5),
		},

		// Server
		Port:    getEnv("PORT", "3503"),
		GinMode: getEnv("GIN_MODE", "release"),
		Server: ServerConfig{
			Port:        getEnv("PORT", "3503"),
			Environment: getEnv("ENVIRONMENT", "development"),
		},

		// JWT
		JWTSecret: getEnv("JWT_SECRET", "your-jwt-secret-key-here"),
		JWT: JWTConfig{
			Secret: getEnv("JWT_SECRET", "your-jwt-secret-key-here"),
		},

		// Email providers
		SendGridAPIKey: getEnv("SENDGRID_API_KEY", ""),
		MailgunAPIKey:  getEnv("MAILGUN_API_KEY", ""),
		MailgunDomain:  getEnv("MAILGUN_DOMAIN", ""),
		ResendAPIKey:   getEnv("RESEND_API_KEY", ""),

		// Default email settings
		DefaultFromEmail: getEnv("DEFAULT_FROM_EMAIL", "admin@zendwise.work"),
		DefaultFromName:  getEnv("DEFAULT_FROM_NAME", "Authentik"),

		// Birthday worker settings
		BirthdayCheckInterval: getEnvAsInt("BIRTHDAY_CHECK_INTERVAL", 3600),
		BirthdayBatchSize:     getEnvAsInt("BIRTHDAY_BATCH_SIZE", 50),
		BirthdayMaxRetries:    getEnvAsInt("BIRTHDAY_MAX_RETRIES", 3),
		BirthdayRetryDelay:    getEnvAsInt("BIRTHDAY_RETRY_DELAY", 300),
		BirthdayWorkerEnabled: getEnvAsBool("BIRTHDAY_WORKER_ENABLED", true),

		// Logging
		LogLevel: getEnv("LOG_LEVEL", "info"),

		// CORS
		CORSAllowedOrigins: getEnvAsSlice("CORS_ALLOWED_ORIGINS", []string{"http://localhost:5173", "http://localhost:3000"}),
		CORS: CORSConfig{
			AllowedOrigins:   getEnvAsSlice("CORS_ALLOWED_ORIGINS", []string{"http://localhost:5173", "http://localhost:3000"}),
			AllowedMethods:   getEnvAsSlice("CORS_ALLOWED_METHODS", []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"}),
			AllowedHeaders:   getEnvAsSlice("CORS_ALLOWED_HEADERS", []string{"Origin", "Content-Type", "Accept", "Authorization"}),
			AllowCredentials: getEnvAsBool("CORS_ALLOW_CREDENTIALS", true),
		},
	}
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func getEnvAsInt(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		if intValue, err := strconv.Atoi(value); err == nil {
			return intValue
		}
	}
	return defaultValue
}

func getEnvAsBool(key string, defaultValue bool) bool {
	if value := os.Getenv(key); value != "" {
		if boolValue, err := strconv.ParseBool(value); err == nil {
			return boolValue
		}
	}
	return defaultValue
}

func getEnvAsSlice(key string, defaultValue []string) []string {
	if value := os.Getenv(key); value != "" {
		return strings.Split(value, ",")
	}
	return defaultValue
}
