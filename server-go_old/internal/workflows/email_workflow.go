package workflows

import (
	"time"

	"email-tracking-server/internal/activities"

	"go.temporal.io/sdk/temporal"
	"go.temporal.io/sdk/workflow"
)

func EmailWorkflow(ctx workflow.Context, emailData activities.EmailData) (*activities.SendEmailResult, error) {
	logger := workflow.GetLogger(ctx)
	logger.Info("Starting email workflow", "email_id", emailData.EmailID)

	// Configure retry policy for email sending
	retryPolicy := &temporal.RetryPolicy{
		InitialInterval:        time.Minute, // 1 minute
		BackoffCoefficient:     1.0,         // No exponential backoff
		MaximumInterval:        time.Minute, // Keep at 1 minute
		MaximumAttempts:        5,           // Retry 5 times
		NonRetryableErrorTypes: []string{},  // Retry all errors
	}

	// Configure activity options
	activityOptions := workflow.ActivityOptions{
		StartToCloseTimeout: 2 * time.Minute,  // Activity timeout
		RetryPolicy:         retryPolicy,      // Apply retry policy
		HeartbeatTimeout:    30 * time.Second, // Heartbeat timeout
	}

	ctx = workflow.WithActivityOptions(ctx, activityOptions)

	logger.Info("Executing send email activity with retry policy",
		"max_attempts", retryPolicy.MaximumAttempts,
		"retry_interval", retryPolicy.InitialInterval)

	var result activities.SendEmailResult
	err := workflow.ExecuteActivity(ctx, "SendEmail", emailData).Get(ctx, &result)

	if err != nil {
		logger.Error("Email workflow failed after all retries", "email_id", emailData.EmailID, "error", err)
		return &activities.SendEmailResult{
			EmailID: emailData.EmailID,
			Status:  "failed",
			SentAt:  time.Now(),
			Error:   err.Error(),
		}, err
	}

	logger.Info("Email workflow completed successfully",
		"email_id", emailData.EmailID,
		"resend_id", result.ResendID,
		"status", result.Status)

	return &result, nil
}

func ScheduledEmailWorkflow(ctx workflow.Context, scheduledAt time.Time, emailData activities.EmailData) (*activities.SendEmailResult, error) {
	logger := workflow.GetLogger(ctx)

	// Calculate delay until scheduled time
	now := workflow.Now(ctx)
	delay := scheduledAt.Sub(now)

	// Detailed logging for debugging
	logger.Info("Starting scheduled email workflow with detailed timing",
		"email_id", emailData.EmailID,
		"scheduled_at", scheduledAt,
		"scheduled_at_utc", scheduledAt.UTC(),
		"scheduled_at_unix", scheduledAt.Unix(),
		"current_time", now,
		"current_time_utc", now.UTC(),
		"current_time_unix", now.Unix(),
		"delay_seconds", delay.Seconds(),
		"delay_duration", delay.String())

	if delay <= 0 {
		logger.Warn("Scheduled time is in the past or now, sending immediately",
			"scheduled_at", scheduledAt,
			"current_time", now,
			"delay", delay)
		delay = 0
	} else {
		logger.Info("Email scheduled for future delivery",
			"delay", delay,
			"delay_minutes", delay.Minutes(),
			"scheduled_at", scheduledAt,
			"current_time", now)
	}

	// Sleep until scheduled time
	if delay > 0 {
		timer := workflow.NewTimer(ctx, delay)
		err := timer.Get(ctx, nil)
		if err != nil {
			logger.Error("Timer failed", "error", err)
			return &activities.SendEmailResult{
				EmailID: emailData.EmailID,
				Status:  "failed",
				SentAt:  time.Now(),
				Error:   "Scheduling timer failed: " + err.Error(),
			}, err
		}
		logger.Info("Timer completed, proceeding with email send", "email_id", emailData.EmailID)
	}

	// Configure retry policy for email sending
	retryPolicy := &temporal.RetryPolicy{
		InitialInterval:        time.Minute,
		BackoffCoefficient:     1.0,
		MaximumInterval:        time.Minute,
		MaximumAttempts:        5,
		NonRetryableErrorTypes: []string{},
	}

	// Configure activity options
	activityOptions := workflow.ActivityOptions{
		StartToCloseTimeout: 2 * time.Minute,
		RetryPolicy:         retryPolicy,
		HeartbeatTimeout:    30 * time.Second,
	}

	ctx = workflow.WithActivityOptions(ctx, activityOptions)

	logger.Info("Executing scheduled send email activity", "email_id", emailData.EmailID)

	var result activities.SendEmailResult
	err := workflow.ExecuteActivity(ctx, "SendEmail", emailData).Get(ctx, &result)

	if err != nil {
		logger.Error("Scheduled email workflow failed after all retries",
			"email_id", emailData.EmailID,
			"error", err)
		return &activities.SendEmailResult{
			EmailID: emailData.EmailID,
			Status:  "failed",
			SentAt:  time.Now(),
			Error:   err.Error(),
		}, err
	}

	logger.Info("Scheduled email workflow completed successfully",
		"email_id", emailData.EmailID,
		"resend_id", result.ResendID,
		"status", result.Status,
		"original_scheduled_at", scheduledAt)

	return &result, nil
}
