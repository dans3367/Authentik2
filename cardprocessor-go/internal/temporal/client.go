package temporal

import (
	"context"
	"fmt"
	"log"
	"time"

	"cardprocessor-go/internal/config"

	"go.temporal.io/sdk/client"
	"go.temporal.io/sdk/worker"
)

// TemporalClient wraps the Temporal client and worker
type TemporalClient struct {
	client client.Client
	worker worker.Worker
	config *config.Config
}

// NewTemporalClient creates a new Temporal client and worker
func NewTemporalClient(cfg *config.Config) (*TemporalClient, error) {
	if !cfg.TemporalWorkerEnabled {
		return nil, fmt.Errorf("temporal worker is disabled")
	}

	// Create Temporal client
	c, err := client.Dial(client.Options{
		HostPort:  cfg.TemporalAddress,
		Namespace: cfg.TemporalNamespace,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create temporal client: %w", err)
	}

	log.Printf("✅ Connected to Temporal server at %s (namespace: %s)", cfg.TemporalAddress, cfg.TemporalNamespace)

	// Create worker
	w := worker.New(c, cfg.TemporalTaskQueue, worker.Options{
		MaxConcurrentActivityExecutionSize:     10,
		MaxConcurrentWorkflowTaskExecutionSize: 5,
	})

	// Register activities
	registerActivities(w)

	log.Printf("✅ Temporal worker created for task queue: %s", cfg.TemporalTaskQueue)

	return &TemporalClient{
		client: c,
		worker: w,
		config: cfg,
	}, nil
}

// Start starts the Temporal worker
func (tc *TemporalClient) Start(ctx context.Context) error {
	log.Printf("🚀 Starting Temporal worker...")
	return tc.worker.Run(worker.InterruptCh())
}

// Stop stops the Temporal worker
func (tc *TemporalClient) Stop() {
	if tc.worker != nil {
		log.Printf("🛑 Stopping Temporal worker...")
		tc.worker.Stop()
	}
	if tc.client != nil {
		tc.client.Close()
	}
}

// StartBirthdayTestWorkflow starts a birthday test workflow
func (tc *TemporalClient) StartBirthdayTestWorkflow(ctx context.Context, input BirthdayTestWorkflowInput) (client.WorkflowRun, error) {
	workflowID := fmt.Sprintf("birthday-test-%s-%d", input.UserID, time.Now().Unix())

	workflowOptions := client.StartWorkflowOptions{
		ID:        workflowID,
		TaskQueue: tc.config.TemporalTaskQueue,
	}

	workflowRun, err := tc.client.ExecuteWorkflow(ctx, workflowOptions, BirthdayTestWorkflow, input)
	if err != nil {
		return nil, fmt.Errorf("failed to start birthday test workflow: %w", err)
	}

	log.Printf("✅ Started birthday test workflow: %s", workflowID)
	return workflowRun, nil
}

// StartBirthdayInvitationWorkflow starts a birthday invitation workflow
func (tc *TemporalClient) StartBirthdayInvitationWorkflow(ctx context.Context, input BirthdayInvitationWorkflowInput) (client.WorkflowRun, error) {
	workflowID := fmt.Sprintf("birthday-invitation-%s-%d", input.ContactID, time.Now().Unix())

	workflowOptions := client.StartWorkflowOptions{
		ID:        workflowID,
		TaskQueue: tc.config.TemporalTaskQueue,
	}

	workflowRun, err := tc.client.ExecuteWorkflow(ctx, workflowOptions, BirthdayInvitationWorkflow, input)
	if err != nil {
		return nil, fmt.Errorf("failed to start birthday invitation workflow: %w", err)
	}

	log.Printf("✅ Started birthday invitation workflow: %s", workflowID)
	return workflowRun, nil
}

// GetWorkflowResult gets the result of a workflow
func (tc *TemporalClient) GetWorkflowResult(ctx context.Context, workflowID string, result interface{}) error {
	workflowHandle := tc.client.GetWorkflow(ctx, workflowID, "")
	return workflowHandle.Get(ctx, result)
}

// IsConnected checks if the Temporal client is connected
func (tc *TemporalClient) IsConnected() bool {
	return tc.client != nil
}
