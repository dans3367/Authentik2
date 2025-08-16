package main

import (
	"context"
	"fmt"
	"os"
	"os/signal"
	"syscall"
	"time"

	"email-tracking-server/internal/activities"
	"email-tracking-server/internal/client"
	"email-tracking-server/internal/workflows"
	"email-tracking-server/pkg/logger"

	"go.temporal.io/sdk/worker"
	"gopkg.in/yaml.v3"
)

type Config struct {
	Temporal struct {
		HostPort  string `yaml:"host_port"`
		Namespace string `yaml:"namespace"`
		TaskQueue string `yaml:"task_queue"`
	} `yaml:"temporal"`
	Email struct {
		ResendAPIKey  string `yaml:"resend_api_key"`
		FromEmail     string `yaml:"from_email"`
		RetryAttempts int    `yaml:"retry_attempts"`
		RetryInterval string `yaml:"retry_interval"`
	} `yaml:"email"`
	JWT struct {
		Secret string `yaml:"secret"`
	} `yaml:"jwt"`
	Approvals struct {
		ApproveBaseURL string `yaml:"approve_base_url"`
	} `yaml:"approvals"`
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
	log.Info("Starting Temporal worker service")

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

	// Create worker
	w := worker.New(temporalClient.GetClient(), config.Temporal.TaskQueue, worker.Options{})

	// Initialize email activity
	emailActivity := activities.NewEmailActivity(
		config.Email.ResendAPIKey,
		config.Email.FromEmail,
		config.JWT.Secret,
		firstNonEmpty(config.Approvals.ApproveBaseURL, os.Getenv("GO_EMAIL_SERVER_BASE_URL"), "https://tengine.zendwise.work"),
		log,
	)

	// Register workflows and activities
	w.RegisterWorkflow(workflows.EmailWorkflow)
	w.RegisterWorkflow(workflows.ScheduledEmailWorkflow)
	w.RegisterWorkflow(workflows.ReviewerApprovalEmailWorkflow)
	w.RegisterActivity(emailActivity.SendEmail)
	w.RegisterActivity(emailActivity.SendApprovalEmail)
	w.RegisterActivity(emailActivity.SendReviewerNotificationEmail)

	log.Info("Temporal worker registered",
		"task_queue", config.Temporal.TaskQueue,
		"workflows", []string{"EmailWorkflow", "ScheduledEmailWorkflow", "ReviewerApprovalEmailWorkflow"},
		"activities", []string{"SendEmail", "SendApprovalEmail", "SendReviewerNotificationEmail"})

	// Set up signal handling for graceful shutdown
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

	// Start worker in a goroutine
	errChan := make(chan error, 1)
	go func() {
		log.Info("Starting Temporal worker")
		if err := w.Run(worker.InterruptCh()); err != nil {
			errChan <- fmt.Errorf("worker failed: %w", err)
		}
	}()

	log.Info("Temporal worker started successfully",
		"task_queue", config.Temporal.TaskQueue,
		"namespace", config.Temporal.Namespace,
		"temporal_host", config.Temporal.HostPort)

	// Wait for shutdown signal or error
	select {
	case sig := <-sigChan:
		log.Info("Received shutdown signal", "signal", sig)

		// Give worker time to finish current tasks
		log.Info("Shutting down worker gracefully...")
		shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer shutdownCancel()

		w.Stop()

		select {
		case <-shutdownCtx.Done():
			log.Warn("Worker shutdown timed out")
		default:
			log.Info("Worker shut down gracefully")
		}

	case err := <-errChan:
		log.Error("Worker error", "error", err)
		os.Exit(1)
	}

	log.Info("Temporal worker service stopped")
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
		Temporal: struct {
			HostPort  string `yaml:"host_port"`
			Namespace string `yaml:"namespace"`
			TaskQueue string `yaml:"task_queue"`
		}{
			HostPort:  getEnvOrDefault("TEMPORAL_HOST", "172.18.0.4:7233"),
			Namespace: getEnvOrDefault("TEMPORAL_NAMESPACE", "default"),
			TaskQueue: getEnvOrDefault("TEMPORAL_TASK_QUEUE", "email-task-queue"),
		},
		Email: struct {
			ResendAPIKey  string `yaml:"resend_api_key"`
			FromEmail     string `yaml:"from_email"`
			RetryAttempts int    `yaml:"retry_attempts"`
			RetryInterval string `yaml:"retry_interval"`
		}{
			ResendAPIKey:  getEnvOrDefault("RESEND_API_KEY", "re_f27r7h2s_BYXi6aNpimSCfCLwMeec686Q"),
			FromEmail:     getEnvOrDefault("FROM_EMAIL", "noreply@zendwise.work"),
			RetryAttempts: 5,
			RetryInterval: "1m",
		},
		JWT: struct {
			Secret string `yaml:"secret"`
		}{
			Secret: getEnvOrDefault("JWT_SECRET", ""),
		},
		Approvals: struct {
			ApproveBaseURL string `yaml:"approve_base_url"`
		}{
			ApproveBaseURL: getEnvOrDefault("GO_EMAIL_SERVER_BASE_URL", "https://tengine.zendwise.work"),
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

func getEnvOrDefault(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func firstNonEmpty(values ...string) string {
	for _, v := range values {
		if v != "" {
			return v
		}
	}
	return ""
}
