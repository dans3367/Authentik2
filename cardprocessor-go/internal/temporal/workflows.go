package temporal

import (
	"time"

	"cardprocessor-go/internal/models"

	"go.temporal.io/sdk/temporal"
	"go.temporal.io/sdk/workflow"
)

// BirthdayTestWorkflowInput represents the input for birthday test workflow
type BirthdayTestWorkflowInput struct {
	UserID                string                 `json:"userId"`
	UserEmail             string                 `json:"userEmail"`
	UserFirstName         string                 `json:"userFirstName"`
	UserLastName          string                 `json:"userLastName"`
	TenantID              string                 `json:"tenantId"`
	TenantName            string                 `json:"tenantName"`
	FromEmail             string                 `json:"fromEmail"`
	EmailTemplate         string                 `json:"emailTemplate"`
	CustomMessage         string                 `json:"customMessage"`
	CustomThemeData       map[string]interface{} `json:"customThemeData"`
	SenderName            string                 `json:"senderName"`
	PromotionID           string                 `json:"promotionId"`
	SplitPromotionalEmail bool                   `json:"splitPromotionalEmail"`
	IsTest                bool                   `json:"isTest"`
}

// BirthdayTestWorkflowResult represents the result of birthday test workflow
type BirthdayTestWorkflowResult struct {
	Success    bool   `json:"success"`
	WorkflowID string `json:"workflowId"`
	MessageID  string `json:"messageId,omitempty"`
	Provider   string `json:"provider,omitempty"`
	Error      string `json:"error,omitempty"`
	SentAt     string `json:"sentAt"`
}

// BirthdayInvitationWorkflowInput represents the input for birthday invitation workflow
type BirthdayInvitationWorkflowInput struct {
	ContactID        string `json:"contactId"`
	ContactEmail     string `json:"contactEmail"`
	ContactFirstName string `json:"contactFirstName"`
	ContactLastName  string `json:"contactLastName"`
	TenantID         string `json:"tenantId"`
	TenantName       string `json:"tenantName"`
	UserID           string `json:"userId"`
	FromEmail        string `json:"fromEmail"`
	BaseURL          string `json:"baseUrl"`
}

// BirthdayInvitationWorkflowResult represents the result of birthday invitation workflow
type BirthdayInvitationWorkflowResult struct {
	ContactID       string `json:"contactId"`
	Success         bool   `json:"success"`
	MessageID       string `json:"messageId,omitempty"`
	Provider        string `json:"provider,omitempty"`
	Error           string `json:"error,omitempty"`
	SentAt          string `json:"sentAt"`
	InvitationToken string `json:"invitationToken,omitempty"`
}

// BirthdayTestWorkflow implements the birthday test card workflow
func BirthdayTestWorkflow(ctx workflow.Context, input BirthdayTestWorkflowInput) (BirthdayTestWorkflowResult, error) {
	logger := workflow.GetLogger(ctx)
	userIDinfo := input.UserID
	logger.Info("🎂 Starting birthday test workflow", "userId", input.UserID, "email", input.UserEmail, userIDinfo)

	// Set activity options
	activityOptions := workflow.ActivityOptions{
		StartToCloseTimeout: 5 * time.Minute,
		HeartbeatTimeout:    1 * time.Minute,
		RetryPolicy: &temporal.RetryPolicy{
			InitialInterval:    1 * time.Second,
			MaximumInterval:    30 * time.Second,
			BackoffCoefficient: 2.0,
			MaximumAttempts:    3,
		},
	}
	ctx = workflow.WithActivityOptions(ctx, activityOptions)

	// Step 1: Generate unsubscribe token and store in database (if not a test)
	var unsubscribeTokenResult TokenResult
	err := workflow.ExecuteActivity(ctx, GenerateBirthdayUnsubscribeToken, TokenInput{
		ContactID: input.UserID, // For test emails, use UserID as ContactID
		TenantID:  input.TenantID,
		Action:    "unsubscribe_birthday",
		ExpiresIn: "never",
	}).Get(ctx, &unsubscribeTokenResult)
	if err != nil {
		logger.Error("Failed to generate unsubscribe token", "error", err)
		// Continue without unsubscribe token rather than failing
		unsubscribeTokenResult.Token = ""
	} else {
		logger.Info("✅ Unsubscribe token generated successfully",
			"hasToken", unsubscribeTokenResult.Token != "",
			"tokenLength", len(unsubscribeTokenResult.Token),
			"success", unsubscribeTokenResult.Success)
	}

	// Step 2: Prepare enriched input with unsubscribe token
	enrichedInput := input
	// Add unsubscribe token to custom theme data
	if enrichedInput.CustomThemeData == nil {
		enrichedInput.CustomThemeData = make(map[string]interface{})
	}
	tokenToAdd := unsubscribeTokenResult.Token
	enrichedInput.CustomThemeData["unsubscribeToken"] = tokenToAdd
	logger.Info("📝 Added unsubscribe token to CustomThemeData",
		"hasToken", tokenToAdd != "",
		"tokenLength", len(tokenToAdd),
		"customThemeDataKeys", len(enrichedInput.CustomThemeData),
		"tokenPreview", func() string {
			if len(tokenToAdd) > 10 {
				return tokenToAdd[:10] + "..."
			}
			return tokenToAdd
		}())

	// Step 3: Fetch promotion data if promotion ID is provided
	var promotion *models.Promotion
	logger.Info("📊 [Debug] Workflow settings",
		"splitPromotionalEmail", input.SplitPromotionalEmail,
		"hasPromotionID", input.PromotionID != "")
	if input.PromotionID != "" {
		err = workflow.ExecuteActivity(ctx, FetchPromotionData, FetchPromotionInput{
			PromotionID: input.PromotionID,
			TenantID:    input.TenantID,
		}).Get(ctx, &promotion)
		if err != nil {
			logger.Error("Failed to fetch promotion data", "error", err)
			// Continue without promotion rather than failing the entire workflow
			promotion = nil
		}
	}

	// Step 4: Check if we should send promotion separately (split email flow)
	logger.Info("📊 [Debug] Checking split email condition",
		"splitPromotionalEmail", input.SplitPromotionalEmail,
		"hasPromotion", promotion != nil,
		"willSplit", input.SplitPromotionalEmail && promotion != nil)
	if input.SplitPromotionalEmail && promotion != nil {
		// SPLIT EMAIL FLOW: Send birthday card WITHOUT promotion, then send promotion separately
		logger.Info("✅ 📧 [SPLIT FLOW] Sending birthday card and promotion as SEPARATE emails for better deliverability")
		logger.Info("📧 [SPLIT FLOW] Email 1/2: Preparing birthday card WITHOUT promotion content")

		// Prepare birthday card WITHOUT promotion (PrepareBirthdayTestEmail sets PromotionContent="")
		var emailContent EmailContent
		err = workflow.ExecuteActivity(ctx, PrepareBirthdayTestEmail, enrichedInput).Get(ctx, &emailContent)
		if err != nil {
			logger.Error("Failed to prepare birthday test email", "error", err)
			return BirthdayTestWorkflowResult{
				Success:    false,
				WorkflowID: workflow.GetInfo(ctx).WorkflowExecution.ID,
				Error:      err.Error(),
				SentAt:     time.Now().Format(time.RFC3339),
			}, nil
		}

		// Send birthday email first
		var sendResult EmailSendResult
		err = workflow.ExecuteActivity(ctx, SendBirthdayTestEmail, emailContent, input.TenantID, "test_card").Get(ctx, &sendResult)
		if err != nil {
			logger.Error("Failed to send birthday test email", "error", err)
			return BirthdayTestWorkflowResult{
				Success:    false,
				WorkflowID: workflow.GetInfo(ctx).WorkflowExecution.ID,
				Error:      err.Error(),
				SentAt:     time.Now().Format(time.RFC3339),
			}, nil
		}

		logger.Info("✅ [SPLIT FLOW] Email 1/2: Birthday card sent successfully (NO promotion included)")
		logger.Info("⏳ [SPLIT FLOW] Waiting 30 seconds before sending promotional email...")

		// Wait 30 seconds between emails for better deliverability
		workflow.Sleep(ctx, 30*time.Second)

		logger.Info("📧 [SPLIT FLOW] Email 2/2: Preparing promotional email (promotion content ONLY)")
		// Prepare and send promotional email separately
		var promoEmailContent EmailContent
		err = workflow.ExecuteActivity(ctx, PreparePromotionalEmail, PreparePromotionalEmailInput{
			ToEmail:          input.UserEmail,
			FromEmail:        input.FromEmail,
			Promotion:        promotion,
			BusinessName:     input.TenantName,
			UnsubscribeToken: unsubscribeTokenResult.Token,
		}).Get(ctx, &promoEmailContent)
		if err != nil {
			logger.Warn("Failed to prepare promotional email (birthday was sent)", "error", err)
			// Don't fail the workflow - birthday email was sent successfully
		} else {
			var promoSendResult EmailSendResult
			err = workflow.ExecuteActivity(ctx, SendPromotionalEmail, promoEmailContent, input.TenantID, input.PromotionID).Get(ctx, &promoSendResult)
			if err != nil {
				logger.Warn("Failed to send promotional email (birthday was sent)", "error", err)
				// Don't fail the workflow - birthday email was sent successfully
			} else {
				logger.Info("✅ [SPLIT FLOW] Email 2/2: Promotional email sent successfully", "messageId", promoSendResult.MessageID)
			}
		}

		// Update status with birthday email send result
		err = workflow.ExecuteActivity(ctx, UpdateBirthdayTestStatus, UpdateStatusInput{
			UserID:    input.UserID,
			TenantID:  input.TenantID,
			Success:   sendResult.Success,
			MessageID: sendResult.MessageID,
			Provider:  sendResult.Provider,
			Error:     sendResult.Error,
		}).Get(ctx, nil)
		if err != nil {
			logger.Warn("Failed to update birthday test status", "error", err)
		}

		logger.Info("✅ [SPLIT FLOW] Birthday test workflow completed - TWO separate emails sent", "success", sendResult.Success)
		return BirthdayTestWorkflowResult{
			Success:    sendResult.Success,
			WorkflowID: workflow.GetInfo(ctx).WorkflowExecution.ID,
			MessageID:  sendResult.MessageID,
			Provider:   sendResult.Provider,
			Error:      sendResult.Error,
			SentAt:     time.Now().Format(time.RFC3339),
		}, nil
	}

	// COMBINED EMAIL FLOW: Send birthday card WITH promotion embedded (old behavior)
	logger.Info("📧 [COMBINED FLOW] Sending COMBINED email (promotion embedded in birthday card)")
	logger.Info("⚠️  [COMBINED FLOW] Split email is disabled or no promotion - sending single email with promotion embedded")
	if promotion != nil {
		logger.Info("Including promotion in birthday test email", "promotionId", promotion.ID, "title", promotion.Title)
	}

	var emailContent EmailContent
	err = workflow.ExecuteActivity(ctx, PrepareBirthdayTestEmailWithPromotion, PrepareBirthdayTestEmailInput{
		WorkflowInput: enrichedInput,
		Promotion:     promotion,
	}).Get(ctx, &emailContent)
	if err != nil {
		logger.Error("Failed to prepare birthday test email", "error", err)
		return BirthdayTestWorkflowResult{
			Success:    false,
			WorkflowID: workflow.GetInfo(ctx).WorkflowExecution.ID,
			Error:      err.Error(),
			SentAt:     time.Now().Format(time.RFC3339),
		}, nil
	}

	// Send birthday test email
	var sendResult EmailSendResult
	err = workflow.ExecuteActivity(ctx, SendBirthdayTestEmail, emailContent, input.TenantID, "test_card").Get(ctx, &sendResult)
	if err != nil {
		logger.Error("Failed to send birthday test email", "error", err)
		return BirthdayTestWorkflowResult{
			Success:    false,
			WorkflowID: workflow.GetInfo(ctx).WorkflowExecution.ID,
			Error:      err.Error(),
			SentAt:     time.Now().Format(time.RFC3339),
		}, nil
	}

	// Update tracking status
	err = workflow.ExecuteActivity(ctx, UpdateBirthdayTestStatus, UpdateStatusInput{
		UserID:    input.UserID,
		TenantID:  input.TenantID,
		Success:   sendResult.Success,
		MessageID: sendResult.MessageID,
		Provider:  sendResult.Provider,
		Error:     sendResult.Error,
	}).Get(ctx, nil)
	if err != nil {
		logger.Warn("Failed to update birthday test status", "error", err)
		// Don't fail the workflow for tracking errors
	}

	logger.Info("✅ Birthday test workflow completed", "success", sendResult.Success)
	return BirthdayTestWorkflowResult{
		Success:    sendResult.Success,
		WorkflowID: workflow.GetInfo(ctx).WorkflowExecution.ID,
		MessageID:  sendResult.MessageID,
		Provider:   sendResult.Provider,
		Error:      sendResult.Error,
		SentAt:     time.Now().Format(time.RFC3339),
	}, nil
}

// BirthdayInvitationWorkflow implements the birthday invitation workflow
func BirthdayInvitationWorkflow(ctx workflow.Context, input BirthdayInvitationWorkflowInput) (BirthdayInvitationWorkflowResult, error) {
	logger := workflow.GetLogger(ctx)
	logger.Info("🎂 Starting birthday invitation workflow", "contactId", input.ContactID, "email", input.ContactEmail)

	// Set activity options
	activityOptions := workflow.ActivityOptions{
		StartToCloseTimeout: 5 * time.Minute,
		HeartbeatTimeout:    1 * time.Minute,
		RetryPolicy: &temporal.RetryPolicy{
			InitialInterval:    1 * time.Second,
			MaximumInterval:    30 * time.Second,
			BackoffCoefficient: 2.0,
			MaximumAttempts:    3,
		},
	}
	ctx = workflow.WithActivityOptions(ctx, activityOptions)

	// Step 1: Generate invitation token
	var tokenResult TokenResult
	err := workflow.ExecuteActivity(ctx, GenerateBirthdayInvitationToken, TokenInput{
		ContactID: input.ContactID,
		Action:    "update_birthday",
		ExpiresIn: "30d",
	}).Get(ctx, &tokenResult)
	if err != nil {
		logger.Error("Failed to generate invitation token", "error", err)
		return BirthdayInvitationWorkflowResult{
			ContactID: input.ContactID,
			Success:   false,
			Error:     err.Error(),
			SentAt:    time.Now().Format(time.RFC3339),
		}, nil
	}

	// Step 2: Prepare invitation email content
	var emailContent EmailContent
	err = workflow.ExecuteActivity(ctx, PrepareBirthdayInvitationEmail, PrepareEmailInput{
		ContactID:        input.ContactID,
		ContactEmail:     input.ContactEmail,
		ContactFirstName: input.ContactFirstName,
		ContactLastName:  input.ContactLastName,
		TenantName:       input.TenantName,
		InvitationToken:  tokenResult.Token,
		BaseURL:          input.BaseURL,
	}).Get(ctx, &emailContent)
	if err != nil {
		logger.Error("Failed to prepare invitation email", "error", err)
		return BirthdayInvitationWorkflowResult{
			ContactID: input.ContactID,
			Success:   false,
			Error:     err.Error(),
			SentAt:    time.Now().Format(time.RFC3339),
		}, nil
	}

	// Step 3: Send invitation email
	var sendResult EmailSendResult
	err = workflow.ExecuteActivity(ctx, SendBirthdayInvitationEmail, SendEmailInput{
		To:              input.ContactEmail,
		From:            input.FromEmail,
		Subject:         emailContent.Subject,
		HTMLContent:     emailContent.HTMLContent,
		TextContent:     emailContent.TextContent,
		TenantID:        input.TenantID,
		ContactID:       input.ContactID,
		InvitationToken: tokenResult.Token,
	}).Get(ctx, &sendResult)
	if err != nil {
		logger.Error("Failed to send invitation email", "error", err)
		return BirthdayInvitationWorkflowResult{
			ContactID: input.ContactID,
			Success:   false,
			Error:     err.Error(),
			SentAt:    time.Now().Format(time.RFC3339),
		}, nil
	}

	// Step 4: Update contact invitation status
	err = workflow.ExecuteActivity(ctx, UpdateContactInvitationStatus, UpdateStatusInput{
		ContactID:       input.ContactID,
		TenantID:        input.TenantID,
		InvitationSent:  true,
		InvitationToken: tokenResult.Token,
		SentAt:          time.Now().Format(time.RFC3339),
	}).Get(ctx, nil)
	if err != nil {
		logger.Warn("Failed to update contact invitation status", "error", err)
		// Don't fail the workflow for tracking errors
	}

	logger.Info("✅ Birthday invitation workflow completed", "success", sendResult.Success)
	return BirthdayInvitationWorkflowResult{
		ContactID:       input.ContactID,
		Success:         sendResult.Success,
		MessageID:       sendResult.MessageID,
		Provider:        sendResult.Provider,
		Error:           sendResult.Error,
		SentAt:          time.Now().Format(time.RFC3339),
		InvitationToken: tokenResult.Token,
	}, nil
}
