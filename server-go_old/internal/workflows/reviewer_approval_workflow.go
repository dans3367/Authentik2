package workflows

import (
    "time"

    "email-tracking-server/internal/activities"

    "go.temporal.io/sdk/temporal"
    "go.temporal.io/sdk/workflow"
)

// ReviewerApprovalEmailWorkflow waits for an external approval signal before sending the email.
// Signal name: "approval" with payload string value "approve".
func ReviewerApprovalEmailWorkflow(ctx workflow.Context, emailData activities.EmailData) (*activities.SendEmailResult, error) {
	logger := workflow.GetLogger(ctx)
	logger.Info("Starting reviewer approval email workflow", "email_id", emailData.EmailID)

	// Default: wait up to 7 days for approval
	approvalTimeout := 7 * 24 * time.Hour

    // First activity: send reviewer notification email (with retry policy)
    retryPolicy := &temporal.RetryPolicy{
        InitialInterval:    time.Minute,
        BackoffCoefficient: 1.0,
        MaximumInterval:    time.Minute,
        MaximumAttempts:    3,
    }
    notificationAO := workflow.ActivityOptions{
        StartToCloseTimeout: 2 * time.Minute,
        RetryPolicy:         retryPolicy,
        HeartbeatTimeout:    30 * time.Second,
    }
    notificationCtx := workflow.WithActivityOptions(ctx, notificationAO)
    var notificationResult activities.SendEmailResult
    logger.Info("Executing SendReviewerNotificationEmail activity")
    err := workflow.ExecuteActivity(notificationCtx, "SendReviewerNotificationEmail", emailData).Get(notificationCtx, &notificationResult)
    
    if err != nil {
        logger.Error("Failed to send reviewer notification email", "error", err)
        // Continue workflow even if notification fails - reviewer can still approve via UI
    } else {
        logger.Info("Reviewer notification email sent", "status", notificationResult.Status)
    }

	approvalChan := workflow.GetSignalChannel(ctx, "approval")
	var approved bool

	// Selector to wait either for approval signal or timeout
	selector := workflow.NewSelector(ctx)

	// Wait for approval signal
	selector.AddReceive(approvalChan, func(c workflow.ReceiveChannel, more bool) {
		var signalPayload string
		c.Receive(ctx, &signalPayload)
		if signalPayload == "approve" {
			approved = true
			logger.Info("Received approval signal", "email_id", emailData.EmailID)
		} else {
			logger.Info("Received non-approve signal, ignoring", "payload", signalPayload)
		}
	})

	// Or timeout
	timerFuture := workflow.NewTimer(ctx, approvalTimeout)
	selector.AddFuture(timerFuture, func(f workflow.Future) {
		approved = false
		logger.Info("Approval timed out", "email_id", emailData.EmailID)
	})

	// Block until one of the above occurs
	selector.Select(ctx)

	if !approved {
		// Do not send email; mark as rejected/timeout via result status
		now := workflow.Now(ctx)
		return &activities.SendEmailResult{
			EmailID: emailData.EmailID,
			Status:  "approval_timeout",
			SentAt:  now,
			Error:   "approval not received within timeout",
		}, nil
	}

	// Once approved, execute the same SendEmail activity as the standard workflow
	// Explicit activity options to avoid any unexpected default differences
	ao := workflow.ActivityOptions{
		StartToCloseTimeout: 2 * time.Minute,
	}
	ctx = workflow.WithActivityOptions(ctx, ao)
	var result activities.SendEmailResult
	err = workflow.ExecuteActivity(ctx, "SendEmail", emailData).Get(ctx, &result)
	if err != nil {
		now := workflow.Now(ctx)
		return &activities.SendEmailResult{
			EmailID: emailData.EmailID,
			Status:  "failed",
			SentAt:  now,
			Error:   err.Error(),
		}, err
	}

	logger.Info("Reviewer approval email workflow completed successfully",
		"email_id", emailData.EmailID,
		"status", result.Status,
		"resend_id", result.ResendID)

	return &result, nil
}
