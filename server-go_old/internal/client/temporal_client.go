package client

import (
	"context"
	"fmt"
	"time"

	"email-tracking-server/pkg/logger"

	"go.temporal.io/sdk/client"
)

type TemporalClient struct {
	client client.Client
	logger *logger.Logger
}

type Config struct {
	HostPort  string
	Namespace string
}

func NewTemporalClient(cfg Config, log *logger.Logger) (*TemporalClient, error) {
	log.Info("Initializing Temporal client", "host_port", cfg.HostPort, "namespace", cfg.Namespace)

	maxRetries := 5
	retryDelay := 2 * time.Second

	var temporalClient client.Client
	var err error

	for attempt := 1; attempt <= maxRetries; attempt++ {
		log.Info("Temporal connection attempt", "attempt", attempt, "max_retries", maxRetries)

		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		options := client.Options{
			HostPort:  cfg.HostPort,
			Namespace: cfg.Namespace,
		}

		temporalClient, err = client.Dial(options)
		if err != nil {
			log.Error("Temporal connection attempt failed", "attempt", attempt, "error", err)
			if attempt == maxRetries {
				return nil, fmt.Errorf("failed to connect to Temporal after %d attempts: %w", maxRetries, err)
			}
			time.Sleep(retryDelay)
			continue
		}

		// Test the connection by checking server health
		_, err = temporalClient.CheckHealth(ctx, nil)
		if err != nil {
			log.Error("Temporal health check failed", "attempt", attempt, "error", err)
			temporalClient.Close()
			if attempt == maxRetries {
				return nil, fmt.Errorf("Temporal health check failed after %d attempts: %w", maxRetries, err)
			}
			time.Sleep(retryDelay)
			continue
		}

		log.Info("Successfully connected to Temporal server")
		break
	}

	return &TemporalClient{
		client: temporalClient,
		logger: log,
	}, nil
}

func (tc *TemporalClient) GetClient() client.Client {
	return tc.client
}

func (tc *TemporalClient) Close() {
	if tc.client != nil {
		tc.client.Close()
		tc.logger.Info("Temporal client connection closed")
	}
}

func (tc *TemporalClient) StartEmailWorkflow(ctx context.Context, workflowID string, taskQueue string, input interface{}) (client.WorkflowRun, error) {
	tc.logger.Info("Starting email workflow", "workflow_id", workflowID, "task_queue", taskQueue)

	workflowOptions := client.StartWorkflowOptions{
		ID:        workflowID,
		TaskQueue: taskQueue,
	}

	workflowRun, err := tc.client.ExecuteWorkflow(ctx, workflowOptions, "EmailWorkflow", input)
	if err != nil {
		tc.logger.Error("Failed to start email workflow", "workflow_id", workflowID, "error", err)
		return nil, fmt.Errorf("failed to start workflow: %w", err)
	}

	tc.logger.Info("Successfully started email workflow",
		"workflow_id", workflowRun.GetID(),
		"run_id", workflowRun.GetRunID())

	return workflowRun, nil
}

func (tc *TemporalClient) StartScheduledEmailWorkflow(ctx context.Context, workflowID string, taskQueue string, scheduledAt time.Time, input interface{}) (client.WorkflowRun, error) {
	tc.logger.Info("Starting scheduled email workflow",
		"workflow_id", workflowID,
		"task_queue", taskQueue,
		"scheduled_at", scheduledAt)

	workflowOptions := client.StartWorkflowOptions{
		ID:        workflowID,
		TaskQueue: taskQueue,
	}

	workflowRun, err := tc.client.ExecuteWorkflow(ctx, workflowOptions, "ScheduledEmailWorkflow", scheduledAt, input)
	if err != nil {
		tc.logger.Error("Failed to start scheduled email workflow", "workflow_id", workflowID, "error", err)
		return nil, fmt.Errorf("failed to start scheduled workflow: %w", err)
	}

	tc.logger.Info("Successfully started scheduled email workflow",
		"workflow_id", workflowRun.GetID(),
		"run_id", workflowRun.GetRunID(),
		"scheduled_at", scheduledAt)

	return workflowRun, nil
}

func (tc *TemporalClient) StartReviewerApprovalEmailWorkflow(ctx context.Context, workflowID string, taskQueue string, input interface{}) (client.WorkflowRun, error) {
	tc.logger.Info("Starting reviewer approval email workflow", "workflow_id", workflowID, "task_queue", taskQueue)

	workflowOptions := client.StartWorkflowOptions{
		ID:        workflowID,
		TaskQueue: taskQueue,
	}

	workflowRun, err := tc.client.ExecuteWorkflow(ctx, workflowOptions, "ReviewerApprovalEmailWorkflow", input)
	if err != nil {
		tc.logger.Error("Failed to start reviewer approval workflow", "workflow_id", workflowID, "error", err)
		return nil, fmt.Errorf("failed to start reviewer approval workflow: %w", err)
	}

	tc.logger.Info("Successfully started reviewer approval email workflow",
		"workflow_id", workflowRun.GetID(),
		"run_id", workflowRun.GetRunID())

	return workflowRun, nil
}

func (tc *TemporalClient) SignalApproval(ctx context.Context, workflowID string, runID string, payload string) error {
	tc.logger.Info("Signaling approval to workflow", "workflow_id", workflowID, "run_id", runID)
	if err := tc.client.SignalWorkflow(ctx, workflowID, runID, "approval", payload); err != nil {
		tc.logger.Error("Failed to signal approval", "workflow_id", workflowID, "error", err)
		return fmt.Errorf("failed to signal approval: %w", err)
	}
	tc.logger.Info("Approval signal sent", "workflow_id", workflowID)
	return nil
}
