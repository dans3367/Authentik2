package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"email-tracking-server/internal/api"
	"email-tracking-server/internal/client"
	"email-tracking-server/pkg/logger"

	"github.com/gorilla/mux"
	"gopkg.in/yaml.v3"
)

type Config struct {
	Server struct {
		Port string `yaml:"port"`
		Host string `yaml:"host"`
	} `yaml:"server"`
	Temporal struct {
		HostPort  string `yaml:"host_port"`
		Namespace string `yaml:"namespace"`
		TaskQueue string `yaml:"task_queue"`
	} `yaml:"temporal"`
	JWT struct {
		Secret string `yaml:"secret"`
	} `yaml:"jwt"`
	Logging struct {
		Level  string `yaml:"level"`
		Format string `yaml:"format"`
	} `yaml:"logging"`
}

func main() {
	// Load configuration
	config, err := loadConfig()
	if err != nil {
		fmt.Printf("Failed to load config: %v\n", err)
		os.Exit(1)
	}

	// Initialize logger
	log := logger.New(config.Logging.Level, config.Logging.Format)
	log.Info("Starting email tracking server")

	// Initialize Temporal client
	temporalClient, err := client.NewTemporalClient(client.Config{
		HostPort:  config.Temporal.HostPort,
		Namespace: config.Temporal.Namespace,
	}, log)
	if err != nil {
		log.Error("Failed to create Temporal client", "error", err)
		os.Exit(1)
	}
	defer temporalClient.Close()

	// Initialize API handler
	apiHandler := api.NewEmailHandler(temporalClient, config.Temporal.TaskQueue, config.JWT.Secret, log)

	// Setup routes
	router := mux.NewRouter()

	// Health check endpoint
	router.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		fmt.Fprintf(w, `{"status":"healthy","temporal":"connected","time":"%s"}`, time.Now().UTC().Format(time.RFC3339))
	}).Methods("GET")

	// Public approval endpoint (no JWT; token-based)
	router.HandleFunc("/approve-email", apiHandler.ApproveEmail).Methods("GET")

	// API routes (protected)
	apiRouter := router.PathPrefix("/api").Subrouter()
	apiRouter.Use(apiHandler.JWTMiddleware)

	apiRouter.HandleFunc("/email-tracking", apiHandler.CreateEmailTracking).Methods("POST")
	apiRouter.HandleFunc("/email-tracking", apiHandler.GetEmailTrackings).Methods("GET")
	apiRouter.HandleFunc("/email-tracking/{id}", apiHandler.GetEmailTracking).Methods("GET")
	apiRouter.HandleFunc("/email-tracking/{id}", apiHandler.UpdateEmailTracking).Methods("PUT")
	apiRouter.HandleFunc("/email-tracking/{id}", apiHandler.DeleteEmailTracking).Methods("DELETE")

	// Lookup email tracking by ResendID
	apiRouter.HandleFunc("/email-tracking/resend/{resendId}", apiHandler.GetEmailTrackingByResendID).Methods("GET")

	// Update ResendID for existing tracking entry
	apiRouter.HandleFunc("/email-tracking/{id}/resend-id", apiHandler.UpdateEmailTrackingResendID).Methods("PUT")

	// Debug and maintenance endpoints
	apiRouter.HandleFunc("/email-tracking/debug/resend-index-status", apiHandler.GetResendIdIndexStatus).Methods("GET")
	apiRouter.HandleFunc("/email-tracking/debug/cleanup-resend-index", apiHandler.CleanupResendIdIndex).Methods("POST")

	// Temporal cleanup endpoint
	apiRouter.HandleFunc("/temporal/clear-workflows", apiHandler.ClearTemporalWorkflows).Methods("POST")

	// Setup server
	server := &http.Server{
		Addr:         fmt.Sprintf("%s:%s", config.Server.Host, config.Server.Port),
		Handler:      enableCORS(router),
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Start server in a goroutine
	go func() {
		log.Info("Starting HTTP server",
			"host", config.Server.Host,
			"port", config.Server.Port,
			"temporal_host", config.Temporal.HostPort)

		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Error("Server failed to start", "error", err)
			os.Exit(1)
		}
	}()

	log.Info("Email tracking server started successfully", "port", config.Server.Port)

	// Set up signal handling for graceful shutdown
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

	// Wait for shutdown signal
	sig := <-sigChan
	log.Info("Received shutdown signal", "signal", sig)

	// Graceful shutdown
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := server.Shutdown(ctx); err != nil {
		log.Error("Server forced to shutdown", "error", err)
		os.Exit(1)
	}

	log.Info("Email tracking server stopped gracefully")
}

func loadConfig() (*Config, error) {
	// Try to load from config file first
	configFile := getEnvOrDefault("CONFIG_FILE", "config/config.yaml")

	if _, err := os.Stat(configFile); err == nil {
		return loadConfigFromFile(configFile)
	}

	// Fallback to environment variables
	return loadConfigFromEnv(), nil
}

func loadConfigFromFile(filename string) (*Config, error) {
	data, err := os.ReadFile(filename)
	if err != nil {
		return nil, fmt.Errorf("failed to read config file: %w", err)
	}

	var config Config
	if err := yaml.Unmarshal(data, &config); err != nil {
		return nil, fmt.Errorf("failed to parse config file: %w", err)
	}

	return &config, nil
}

func loadConfigFromEnv() *Config {
	return &Config{
		Server: struct {
			Port string `yaml:"port"`
			Host string `yaml:"host"`
		}{
			Port: getEnvOrDefault("PORT", "8095"),
			Host: getEnvOrDefault("HOST", "0.0.0.0"),
		},
		Temporal: struct {
			HostPort  string `yaml:"host_port"`
			Namespace string `yaml:"namespace"`
			TaskQueue string `yaml:"task_queue"`
		}{
			HostPort:  getEnvOrDefault("TEMPORAL_HOST", "172.18.0.4:7233"),
			Namespace: getEnvOrDefault("TEMPORAL_NAMESPACE", "default"),
			TaskQueue: getEnvOrDefault("TEMPORAL_TASK_QUEUE", "email-task-queue"),
		},
		JWT: struct {
			Secret string `yaml:"secret"`
		}{
			Secret: getEnvOrDefault("JWT_SECRET", "Cvgii9bYKF1HtfD8TODRyZFTmFP4vu70oR59YrjGVpS2fXzQ41O3UPRaR8u9uAqNhwK5ZxZPbX5rAOlMrqe8ag=="),
		},
		Logging: struct {
			Level  string `yaml:"level"`
			Format string `yaml:"format"`
		}{
			Level:  getEnvOrDefault("LOG_LEVEL", "info"),
			Format: getEnvOrDefault("LOG_FORMAT", "json"),
		},
	}
}

func enableCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")

		// Define allowed origins
		allowedOrigins := []string{
			"http://localhost:5173",           // Local development (Vite)
			"http://localhost:5000",           // Local development (main app)
			"https://app.zendwise.work",       // Production main app
			"https://zendwise.work",           // Production main domain
			"https://tengine.zendwise.work",   // Go server subdomain
			"https://authentik.zendwise.work", // Authentik subdomain if exists
			"https://637573c3-49ca-4c2a-a66f-8a199454d465-00-1y6orip6wcu6p.janeway.replit.dev", // Replit development domain
		}

		// Check if origin is allowed
		originAllowed := false
		for _, allowedOrigin := range allowedOrigins {
			if origin == allowedOrigin {
				originAllowed = true
				break
			}
		}

		// Set CORS headers
		if originAllowed {
			w.Header().Set("Access-Control-Allow-Origin", origin)
		} else {
			// Fallback to wildcard for development/testing
			w.Header().Set("Access-Control-Allow-Origin", "*")
		}

		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		w.Header().Set("Access-Control-Allow-Credentials", "true")
		w.Header().Set("Access-Control-Max-Age", "86400") // 24 hours

		// Handle preflight requests
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		next.ServeHTTP(w, r)
	})
}

func getEnvOrDefault(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
