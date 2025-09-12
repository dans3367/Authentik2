package workflows

import (
	"time"

	"email-tracking-server/internal/activities"

	"go.temporal.io/sdk/temporal"
	"go.temporal.io/sdk/workflow"
)

func PostmarkEmailWorkflow(ctx workflow.Context, emailData activities.EmailData) (*activities.PostmarkSendEmailResult, error) {
	logger := workflow.GetLogger(ctx)
	logger.Info("Starting Postmark email workflow", "email_id", emailData.EmailID)

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

	logger.Info("Executing Postmark send email activity with retry policy",
		"max_attempts", retryPolicy.MaximumAttempts,
		"retry_interval", retryPolicy.InitialInterval)

	var result activities.PostmarkSendEmailResult
	err := workflow.ExecuteActivity(ctx, "SendPostmarkEmail", emailData).Get(ctx, &result)

	if err != nil {
		logger.Error("Postmark email workflow failed after all retries", "email_id", emailData.EmailID, "error", err)
		return &activities.PostmarkSendEmailResult{
			EmailID: emailData.EmailID,
			Status:  "failed",
			SentAt:  time.Now(),
			Error:   err.Error(),
		}, err
	}

	logger.Info("Postmark email workflow completed successfully",
		"email_id", emailData.EmailID,
		"postmark_id", result.PostmarkID,
		"status", result.Status)

	return &result, nil
}

func PostmarkScheduledEmailWorkflow(ctx workflow.Context, scheduledAt time.Time, emailData activities.EmailData) (*activities.PostmarkSendEmailResult, error) {
	logger := workflow.GetLogger(ctx)

	// Calculate delay until scheduled time
	now := workflow.Now(ctx)
	delay := scheduledAt.Sub(now)

	// Detailed logging for debugging
	logger.Info("Starting Postmark scheduled email workflow with detailed timing",
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
		logger.Info("Email scheduled for future delivery via Postmark",
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
			return &activities.PostmarkSendEmailResult{
				EmailID: emailData.EmailID,
				Status:  "failed",
				SentAt:  time.Now(),
				Error:   "Scheduling timer failed: " + err.Error(),
			}, err
		}
		logger.Info("Timer completed, proceeding with Postmark email send", "email_id", emailData.EmailID)
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

	logger.Info("Executing Postmark scheduled send email activity", "email_id", emailData.EmailID)

	var result activities.PostmarkSendEmailResult
	err := workflow.ExecuteActivity(ctx, "SendPostmarkEmail", emailData).Get(ctx, &result)

	if err != nil {
		logger.Error("Postmark scheduled email workflow failed after all retries",
			"email_id", emailData.EmailID,
			"error", err)
		return &activities.PostmarkSendEmailResult{
			EmailID: emailData.EmailID,
			Status:  "failed",
			SentAt:  time.Now(),
			Error:   err.Error(),
		}, err
	}

	logger.Info("Postmark scheduled email workflow completed successfully",
		"email_id", emailData.EmailID,
		"postmark_id", result.PostmarkID,
		"status", result.Status,
		"original_scheduled_at", scheduledAt)

	return &result, nil
}

func PostmarkReviewerApprovalEmailWorkflow(ctx workflow.Context, emailData activities.EmailData) (*activities.PostmarkSendEmailResult, error) {
	logger := workflow.GetLogger(ctx)
	logger.Info("Starting Postmark reviewer approval email workflow", "email_id", emailData.EmailID)

	// Configure retry policy for approval activities
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

	// Step 1: Send reviewer notification email
	logger.Info("Sending Postmark reviewer notification email", "email_id", emailData.EmailID)
	var notificationResult activities.PostmarkSendEmailResult
	err := workflow.ExecuteActivity(ctx, "SendPostmarkReviewerNotificationEmail", emailData).Get(ctx, &notificationResult)
	if err != nil {
		logger.Error("Failed to send Postmark reviewer notification email", "email_id", emailData.EmailID, "error", err)
		return &activities.PostmarkSendEmailResult{
			EmailID: emailData.EmailID,
			Status:  "reviewer_notification_failed",
			SentAt:  time.Now(),
			Error:   err.Error(),
		}, err
	}

	logger.Info("Postmark reviewer notification sent",
		"email_id", emailData.EmailID,
		"notification_result", notificationResult.Status,
		"postmark_id", notificationResult.PostmarkID)

	// Step 2: Wait for approval signal or timeout
	logger.Info("Waiting for approval signal via Postmark workflow", "email_id", emailData.EmailID)

	// Create a selector to wait for approval signal or timeout
	selector := workflow.NewSelector(ctx)

	// Set up approval signal channel
	approvalChannel := workflow.GetSignalChannel(ctx, "approve-email")
	var approvalReceived bool
	selector.AddReceive(approvalChannel, func(c workflow.ReceiveChannel, more bool) {
		var signal map[string]interface{}
		c.Receive(ctx, &signal)
		logger.Info("Received approval signal for Postmark workflow", "email_id", emailData.EmailID, "signal", signal)
		approvalReceived = true
	})

	// Set up timeout (7 days)
	timer := workflow.NewTimer(ctx, 7*24*time.Hour)
	selector.AddFuture(timer, func(f workflow.Future) {
		logger.Warn("Approval timeout reached for Postmark workflow", "email_id", emailData.EmailID)
		approvalReceived = false
	})

	// Wait for either approval or timeout
	selector.Select(ctx)

	if !approvalReceived {
		logger.Error("Approval timeout for Postmark email workflow", "email_id", emailData.EmailID)
		return &activities.PostmarkSendEmailResult{
			EmailID: emailData.EmailID,
			Status:  "approval_timeout",
			SentAt:  time.Now(),
			Error:   "Approval timeout reached after 7 days",
		}, nil
	}

	// Step 3: Send the actual email after approval
	logger.Info("Approval received, sending Postmark email", "email_id", emailData.EmailID)
	var emailResult activities.PostmarkSendEmailResult
	err = workflow.ExecuteActivity(ctx, "SendPostmarkEmail", emailData).Get(ctx, &emailResult)
	if err != nil {
		logger.Error("Failed to send approved Postmark email", "email_id", emailData.EmailID, "error", err)
		return &activities.PostmarkSendEmailResult{
			EmailID: emailData.EmailID,
			Status:  "failed_after_approval",
			SentAt:  time.Now(),
			Error:   err.Error(),
		}, err
	}

	logger.Info("Postmark reviewer approval email workflow completed successfully",
		"email_id", emailData.EmailID,
		"postmark_id", emailResult.PostmarkID,
		"final_status", emailResult.Status)

	// Update status to indicate it was approved
	emailResult.Status = "sent_after_approval"
	return &emailResult, nil
}
