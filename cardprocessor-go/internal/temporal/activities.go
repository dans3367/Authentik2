package temporal

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"html/template"
	"net/http"
	"strings"
	"time"

	"cardprocessor-go/internal/config"
	"cardprocessor-go/internal/models"
	"cardprocessor-go/internal/repository"

	"go.temporal.io/sdk/activity"
)

// Activity dependencies
type ActivityDependencies struct {
	Config *config.Config
	Repo   *repository.Repository
}

var activityDeps *ActivityDependencies

// SetActivityDependencies sets the activity dependencies
func SetActivityDependencies(cfg *config.Config, repo *repository.Repository) {
	activityDeps = &ActivityDependencies{
		Config: cfg,
		Repo:   repo,
	}
}

// EmailContent represents prepared email content
type EmailContent struct {
	Subject     string `json:"subject"`
	HTMLContent string `json:"htmlContent"`
	TextContent string `json:"textContent"`
	To          string `json:"to"`
	From        string `json:"from"`
}

// EmailSendResult represents the result of sending an email
type EmailSendResult struct {
	Success   bool   `json:"success"`
	MessageID string `json:"messageId,omitempty"`
	Provider  string `json:"provider,omitempty"`
	Error     string `json:"error,omitempty"`
}

// EmailContext contains metadata for tracking outgoing emails
type EmailContext struct {
	TenantID     string
	ContactID    *string
	EmailType    string // 'birthday_card', 'test_card', 'promotional', etc.
	NewsletterID *string
	CampaignID   *string
	PromotionID  *string
	Metadata     map[string]interface{}
}


// TokenInput represents input for token generation
type TokenInput struct {
	ContactID string `json:"contactId"`
	TenantID  string `json:"tenantId"`
	Action    string `json:"action"`
	ExpiresIn string `json:"expiresIn"`
}

// TokenResult represents the result of token generation
type TokenResult struct {
	Success bool   `json:"success"`
	Token   string `json:"token,omitempty"`
	Error   string `json:"error,omitempty"`
}

// PrepareEmailInput represents input for preparing email content
type PrepareEmailInput struct {
	ContactID        string `json:"contactId"`
	ContactEmail     string `json:"contactEmail"`
	ContactFirstName string `json:"contactFirstName"`
	ContactLastName  string `json:"contactLastName"`
	TenantName       string `json:"tenantName"`
	InvitationToken  string `json:"invitationToken"`
	BaseURL          string `json:"baseUrl"`
}

// SendEmailInput represents input for sending email
type SendEmailInput struct {
	To              string `json:"to"`
	From            string `json:"from"`
	Subject         string `json:"subject"`
	HTMLContent     string `json:"htmlContent"`
	TextContent     string `json:"textContent"`
	TenantID        string `json:"tenantId"`
	ContactID       string `json:"contactId"`
	InvitationToken string `json:"invitationToken"`
}

// UpdateStatusInput represents input for updating status
type UpdateStatusInput struct {
	UserID          string `json:"userId,omitempty"`
	ContactID       string `json:"contactId,omitempty"`
	TenantID        string `json:"tenantId"`
	Success         bool   `json:"success"`
	MessageID       string `json:"messageId,omitempty"`
	Provider        string `json:"provider,omitempty"`
	Error           string `json:"error,omitempty"`
	InvitationSent  bool   `json:"invitationSent,omitempty"`
	InvitationToken string `json:"invitationToken,omitempty"`
	SentAt          string `json:"sentAt"`
}

// FetchPromotionInput represents input for fetching promotion data
type FetchPromotionInput struct {
	PromotionID string `json:"promotionId"`
	TenantID    string `json:"tenantId"`
}

// FetchPromotionData fetches promotion data for birthday cards
func FetchPromotionData(ctx context.Context, input FetchPromotionInput) (*models.Promotion, error) {
	logger := activity.GetLogger(ctx)
	logger.Info("🎁 Fetching promotion data", "promotionId", input.PromotionID, "tenantId", input.TenantID)

	if input.PromotionID == "" {
		logger.Info("No promotion ID provided, skipping promotion fetch")
		return nil, nil
	}

	promotion, err := activityDeps.Repo.GetPromotion(ctx, input.PromotionID, input.TenantID)
	if err != nil {
		logger.Error("Failed to fetch promotion", "error", err)
		return nil, fmt.Errorf("failed to fetch promotion: %w", err)
	}

	if promotion == nil {
		logger.Info("No active promotion found", "promotionId", input.PromotionID)
		return nil, nil
	}

	logger.Info("✅ Promotion fetched successfully", "promotionId", promotion.ID, "title", promotion.Title)
	return promotion, nil
}

// PrepareBirthdayTestEmailInput represents input for preparing birthday test email with promotion
type PrepareBirthdayTestEmailInput struct {
	WorkflowInput BirthdayTestWorkflowInput `json:"workflowInput"`
	Promotion     *models.Promotion         `json:"promotion"`
}

// PreparePromotionalEmailInput represents input for preparing promotional email
type PreparePromotionalEmailInput struct {
	ToEmail          string            `json:"toEmail"`
	FromEmail        string            `json:"fromEmail"`
	Promotion        *models.Promotion `json:"promotion"`
	BusinessName     string            `json:"businessName"`
	UnsubscribeToken string            `json:"unsubscribeToken"`
}

// PrepareBirthdayTestEmailWithPromotion prepares birthday test email content with promotion data
func PrepareBirthdayTestEmailWithPromotion(ctx context.Context, input PrepareBirthdayTestEmailInput) (EmailContent, error) {
	logger := activity.GetLogger(ctx)
	logger.Info("📧 Preparing birthday test email with promotion", "userId", input.WorkflowInput.UserID, "email", input.WorkflowInput.UserEmail)

	// Generate HTML content for birthday test card with promotion
	htmlContent := generateBirthdayTestHTMLWithPromotion(input.WorkflowInput, input.Promotion)

	// Generate text content (simplified version)
	textContent := fmt.Sprintf("Happy Birthday %s!\n\n%s\n\nBest regards,\n%s",
		input.WorkflowInput.UserFirstName, input.WorkflowInput.CustomMessage, input.WorkflowInput.SenderName)

	return EmailContent{
		Subject:     fmt.Sprintf("🎂 Happy Birthday %s!", input.WorkflowInput.UserFirstName),
		HTMLContent: htmlContent,
		TextContent: textContent,
		To:          input.WorkflowInput.UserEmail,
		From:        activityDeps.Config.DefaultFromEmail,
	}, nil
}

// PrepareBirthdayTestEmail prepares birthday test email content WITHOUT promotion (for split email flow)
func PrepareBirthdayTestEmail(ctx context.Context, input BirthdayTestWorkflowInput) (EmailContent, error) {
	logger := activity.GetLogger(ctx)
	logger.Info("📧 [SPLIT FLOW] Preparing birthday test email WITHOUT promotion content",
		"userId", input.UserID,
		"email", input.UserEmail)

	// Generate HTML content for birthday test card (WITHOUT promotion)
	htmlContent := generateBirthdayTestHTML(input)

	// Generate text content (simplified version)
	textContent := fmt.Sprintf("Happy Birthday %s!\n\n%s\n\nBest regards,\n%s",
		input.UserFirstName, input.CustomMessage, input.SenderName)

	logger.Info("✅ [SPLIT FLOW] Birthday email prepared WITHOUT promotion - ready to send",
		"subject", fmt.Sprintf("🎉 Happy Birthday %s!", input.UserFirstName))

	return EmailContent{
		Subject:     fmt.Sprintf("🎉 Happy Birthday %s! (Test - %s template)", input.UserFirstName, input.EmailTemplate),
		HTMLContent: htmlContent,
		TextContent: textContent,
		To:          input.UserEmail,
		From:        input.FromEmail,
	}, nil
}

// SendBirthdayTestEmail sends birthday test email
func SendBirthdayTestEmail(ctx context.Context, content EmailContent, tenantID string, emailType string) (EmailSendResult, error) {
	logger := activity.GetLogger(ctx)
	logger.Info("📤 Sending birthday test email", "to", content.To, "tenantId", tenantID, "emailType", emailType)

	// Create EmailContext for tracking
	emailCtx := &EmailContext{
		TenantID:  tenantID,
		EmailType: emailType,
		Metadata: map[string]interface{}{
			"recipientEmail": content.To,
		},
	}

	// Try different email providers in order of preference
	providers := []string{"resend", "sendgrid", "mailgun"}

	for _, provider := range providers {
		result, err := sendEmailViaProvider(ctx, provider, content, emailCtx)
		if err == nil && result.Success {
			logger.Info("✅ Birthday test email sent successfully", "provider", provider, "messageId", result.MessageID)
			return result, nil
		}
		logger.Warn("❌ Failed to send via provider", "provider", provider, "error", err)
	}

	return EmailSendResult{
		Success: false,
		Error:   "All email providers failed",
	}, fmt.Errorf("all email providers failed")
}

// PrepareBirthdayInvitationEmail prepares birthday invitation email content
func PrepareBirthdayInvitationEmail(ctx context.Context, input PrepareEmailInput) (EmailContent, error) {
	logger := activity.GetLogger(ctx)
	logger.Info("📧 Preparing birthday invitation email", "contactId", input.ContactID, "email", input.ContactEmail)

	// Generate HTML content for birthday invitation
	htmlContent := generateBirthdayInvitationHTML(input)

	// Generate text content (simplified version)
	textContent := fmt.Sprintf("Hi %s,\n\nWe'd love to help celebrate your special day! Please update your birthday information.\n\nClick here: %s/birthday-update?token=%s\n\nBest regards,\n%s",
		input.ContactFirstName, input.BaseURL, input.InvitationToken, input.TenantName)

	return EmailContent{
		Subject:     "🎂 Help us celebrate your special day!",
		HTMLContent: htmlContent,
		TextContent: textContent,
		To:          input.ContactEmail,
		From:        activityDeps.Config.DefaultFromEmail,
	}, nil
}

// SendBirthdayInvitationEmail sends birthday invitation email
func SendBirthdayInvitationEmail(ctx context.Context, input SendEmailInput) (EmailSendResult, error) {
	logger := activity.GetLogger(ctx)
	logger.Info("📤 Sending birthday invitation email", "to", input.To, "tenantId", input.TenantID, "contactId", input.ContactID)

	content := EmailContent{
		Subject:     input.Subject,
		HTMLContent: input.HTMLContent,
		TextContent: input.TextContent,
		To:          input.To,
		From:        input.From,
	}

	// Create EmailContext for tracking
	emailCtx := &EmailContext{
		TenantID:  input.TenantID,
		ContactID: &input.ContactID,
		EmailType: "invitation",
		Metadata: map[string]interface{}{
			"recipientEmail": input.To,
			"invitationToken": input.InvitationToken,
		},
	}

	// Try different email providers in order of preference
	providers := []string{"resend", "sendgrid", "mailgun"}

	for _, provider := range providers {
		result, err := sendEmailViaProvider(ctx, provider, content, emailCtx)
		if err == nil && result.Success {
			logger.Info("✅ Birthday invitation email sent successfully", "provider", provider, "messageId", result.MessageID)
			return result, nil
		}
		logger.Warn("❌ Failed to send via provider", "provider", provider, "error", err)
	}

	return EmailSendResult{
		Success: false,
		Error:   "All email providers failed",
	}, fmt.Errorf("all email providers failed")
}

// GenerateBirthdayInvitationToken generates a JWT token for birthday invitation
func GenerateBirthdayInvitationToken(ctx context.Context, input TokenInput) (TokenResult, error) {
	logger := activity.GetLogger(ctx)
	logger.Info("🔑 Generating birthday invitation token", "contactId", input.ContactID)

	// For now, generate a simple token (in production, use proper JWT)
	token := fmt.Sprintf("birthday_invitation_%s_%d", input.ContactID, time.Now().Unix())

	return TokenResult{
		Success: true,
		Token:   token,
	}, nil
}

func GenerateBirthdayUnsubscribeToken(ctx context.Context, input TokenInput) (TokenResult, error) {
	logger := activity.GetLogger(ctx)
	logger.Info("🔑 Generating birthday unsubscribe token", "contactId", input.ContactID, "tenantId", input.TenantID)

	// Generate a secure random token
	tokenBytes := make([]byte, 32)
	_, err := rand.Read(tokenBytes)
	if err != nil {
		return TokenResult{Success: false, Error: "Failed to generate token"}, err
	}
	token := hex.EncodeToString(tokenBytes)

	// Store the token in the database
	if input.TenantID != "" && input.ContactID != "" {
		// Store token in the database
		logger.Info("💾 Storing unsubscribe token in database", "contactId", input.ContactID, "tenantId", input.TenantID)
		
		_, err = activityDeps.Repo.CreateBirthdayUnsubscribeToken(ctx, input.TenantID, input.ContactID, token)
		if err != nil {
			logger.Error("❌ Failed to store unsubscribe token in database", "error", err)
			// Continue anyway - token can still be used even if not stored
			// This allows test emails to work without requiring valid contact IDs
		} else {
			logger.Info("✅ Unsubscribe token stored successfully in database")
		}
	} else {
		logger.Warn("⚠️  No tenant/contact ID provided - token will not be stored in database", 
			"tenantId", input.TenantID, 
			"contactId", input.ContactID)
	}

	result := TokenResult{Success: true, Token: token}
	logger.Info("🎫 Returning token result", "success", result.Success, "hasToken", result.Token != "", "tokenLength", len(result.Token))
	return result, nil
}

// UpdateBirthdayTestStatus updates the birthday test status in database
func UpdateBirthdayTestStatus(ctx context.Context, input UpdateStatusInput) error {
	logger := activity.GetLogger(ctx)
	logger.Info("📊 Updating birthday test status", "userId", input.UserID)

	// TODO: Implement database update for birthday test status
	// This would typically update a tracking table with the test results

	return nil
}

// UpdateContactInvitationStatus updates contact invitation status in database
func UpdateContactInvitationStatus(ctx context.Context, input UpdateStatusInput) error {
	logger := activity.GetLogger(ctx)
	logger.Info("📊 Updating contact invitation status", "contactId", input.ContactID)

	// TODO: Implement database update for contact invitation status
	// This would typically update the contact record with invitation tracking info

	return nil
}

// recordOutgoingEmail records an outgoing email in the database
// recordOutgoingEmail saves email tracking info to database
func recordOutgoingEmail(ctx context.Context, content EmailContent, result EmailSendResult, emailCtx *EmailContext) error {
	logger := activity.GetLogger(ctx)
	fmt.Printf("DEBUG: Inside recordOutgoingEmail function\\n")
	logger.Info("🔍 Starting recordOutgoingEmail using new split table structure", 
		"provider", result.Provider, 
		"messageId", result.MessageID,
		"success", result.Success,
		"recipient", content.To)
		
	if activityDeps == nil || activityDeps.Repo == nil {
		logger.Warn("❌ Skipping email record - dependencies not set", 
			"activityDeps", activityDeps != nil,
			"repo", activityDeps != nil && activityDeps.Repo != nil)
		return nil
	}
	if emailCtx == nil {
		logger.Warn("❌ Skipping email record - EmailContext is nil (no tenantId)")
		return nil
	}
	
	logger.Info("📝 EmailContext details", 
		"tenantId", emailCtx.TenantID,
		"emailType", emailCtx.EmailType,
		"contactId", emailCtx.ContactID,
		"promotionId", emailCtx.PromotionID)
	
	// Extract recipient name from content if available
	var recipientName *string
	if emailCtx.Metadata != nil {
		if name, ok := emailCtx.Metadata["recipientName"].(string); ok && name != "" {
			recipientName = &name
		}
	}
	
	// Serialize metadata
	var metadataJSON *string
	if emailCtx.Metadata != nil && len(emailCtx.Metadata) > 0 {
		if jsonBytes, err := json.Marshal(emailCtx.Metadata); err == nil {
			metadataStr := string(jsonBytes)
			metadataJSON = &metadataStr
		}
	}

	status := "sent"
	var errorMsg *string
	if !result.Success {
		status = "failed"
		errorMsg = &result.Error
	}

	req := &models.CreateCompleteEmailRequest{
		TenantID:          emailCtx.TenantID,
		RecipientEmail:    content.To,
		RecipientName:     recipientName,
		SenderEmail:       content.From,
		SenderName:        nil,
		Subject:           content.Subject,
		EmailType:         emailCtx.EmailType,
		Provider:          result.Provider,
		ProviderMessageID: &result.MessageID,
		Status:            status,
		SendAttempts:      1,
		ErrorMessage:      errorMsg,
		ContactID:         emailCtx.ContactID,
		NewsletterID:      emailCtx.NewsletterID,
		CampaignID:        emailCtx.CampaignID,
		PromotionID:       emailCtx.PromotionID,
		HTMLContent:       &content.HTMLContent,
		TextContent:       &content.TextContent,
		Metadata:          metadataJSON,
	}

	logger.Info("📤 Attempting to save email using new split table structure",
		"tenantId", req.TenantID,
		"emailType", req.EmailType,
		"provider", req.Provider)

	emailSendWithDetails, err := activityDeps.Repo.CreateCompleteEmail(ctx, req)
	if err != nil {
		logger.Error("❌ Failed to record email using split tables", 
			"error", err, 
			"recipient", content.To,
			"tenantId", emailCtx.TenantID)
		// Don't fail the email send if tracking fails
		return nil
	}

	// Create an email event for the send result
	eventType := "sent"
	if !result.Success {
		eventType = "failed"
	}
	
	// Create provider response data
	var providerResponse *string
	if result.Success && result.MessageID != "" {
		responseData := map[string]interface{}{
			"message_id": result.MessageID,
			"provider":   result.Provider,
		}
		if jsonBytes, err := json.Marshal(responseData); err == nil {
			responseStr := string(jsonBytes)
			providerResponse = &responseStr
		}
	}

	eventReq := &models.CreateEmailEventRequest{
		EmailSendID:      emailSendWithDetails.EmailSend.ID,
		EventType:        eventType,
		EventData:        metadataJSON,
		ProviderResponse: providerResponse,
	}

	_, err = activityDeps.Repo.CreateEmailEvent(ctx, eventReq)
	if err != nil {
		logger.Warn("⚠️ Failed to create email event, but email was recorded", 
			"error", err, 
			"emailSendId", emailSendWithDetails.EmailSend.ID)
	}

	logger.Info("✅ Successfully recorded email using split table structure", 
		"messageId", result.MessageID, 
		"type", emailCtx.EmailType, 
		"recipient", content.To,
		"tenantId", emailCtx.TenantID,
		"emailSendId", emailSendWithDetails.EmailSend.ID)
	return nil
}
func sendEmailViaProvider(ctx context.Context, provider string, content EmailContent, emailCtx *EmailContext) (EmailSendResult, error) {
	switch provider {
	case "resend":
		return sendViaResend(ctx, content, emailCtx)
	case "sendgrid":
		return sendViaSendGrid(ctx, content, emailCtx)
	case "mailgun":
		return sendViaMailgun(ctx, content, emailCtx)
	default:
		return EmailSendResult{Success: false, Error: "Unknown provider"}, fmt.Errorf("unknown provider: %s", provider)
	}
}

// sendViaResend sends email via Resend API
func sendViaResend(ctx context.Context, content EmailContent, emailCtx *EmailContext) (EmailSendResult, error) {
	if activityDeps.Config.ResendAPIKey == "" {
		return EmailSendResult{Success: false, Error: "Resend API key not configured"}, fmt.Errorf("resend API key not configured")
	}

	// Extract unsubscribe URL from HTML content to add to List-Unsubscribe header
	// This prevents Resend from wrapping the unsubscribe link in click tracking
	headers := make(map[string]string)
	if strings.Contains(content.HTMLContent, "/api/unsubscribe/birthday?token=") {
		// Extract the unsubscribe URL
		start := strings.Index(content.HTMLContent, "http")
		if start != -1 {
			end := strings.Index(content.HTMLContent[start:], `"`)
			if end != -1 {
				unsubUrl := content.HTMLContent[start : start+end]
				if strings.Contains(unsubUrl, "/api/unsubscribe/birthday?token=") {
					headers["List-Unsubscribe"] = "<" + unsubUrl + ">"
					headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click"
				}
			}
		}
	}

	payload := map[string]interface{}{
		"from":    content.From,
		"to":      []string{content.To},
		"subject": content.Subject,
		"html":    content.HTMLContent,
		"text":    content.TextContent,
	}

	// Add headers if we found an unsubscribe link
	if len(headers) > 0 {
		payload["headers"] = headers
	}

	jsonData, _ := json.Marshal(payload)

	req, err := http.NewRequestWithContext(ctx, "POST", "https://api.resend.com/emails", bytes.NewBuffer(jsonData))
	if err != nil {
		return EmailSendResult{Success: false, Error: err.Error()}, err
	}

	req.Header.Set("Authorization", "Bearer "+activityDeps.Config.ResendAPIKey)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return EmailSendResult{Success: false, Error: err.Error()}, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 && resp.StatusCode != 201 && resp.StatusCode != 202 {
		return EmailSendResult{Success: false, Error: "Resend API error"}, fmt.Errorf("resend API returned status %d", resp.StatusCode)
	}

	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)

	// Build result safely
	msgID := ""
	if v, ok := result["id"].(string); ok {
		msgID = v
	}
	sendResult := EmailSendResult{
		Success:   true,
		MessageID: msgID,
		Provider:  "resend",
	}

	// Record outgoing email (best-effort)
	fmt.Printf("DEBUG: About to call recordOutgoingEmail - emailCtx: %+v\\n", emailCtx)
	_ = recordOutgoingEmail(ctx, content, sendResult, emailCtx)
	return sendResult, nil
}

// sendViaSendGrid sends email via SendGrid API
func sendViaSendGrid(ctx context.Context, content EmailContent, emailCtx *EmailContext) (EmailSendResult, error) {
	if activityDeps.Config.SendGridAPIKey == "" {
		return EmailSendResult{Success: false, Error: "SendGrid API key not configured"}, fmt.Errorf("sendgrid API key not configured")
	}

	// TODO: Implement SendGrid API call
	return EmailSendResult{Success: false, Error: "SendGrid not implemented"}, fmt.Errorf("sendgrid not implemented")
}

// sendViaMailgun sends email via Mailgun API
func sendViaMailgun(ctx context.Context, content EmailContent, emailCtx *EmailContext) (EmailSendResult, error) {
	if activityDeps.Config.MailgunAPIKey == "" || activityDeps.Config.MailgunDomain == "" {
		return EmailSendResult{Success: false, Error: "Mailgun API key or domain not configured"}, fmt.Errorf("mailgun not configured")
	}

	// TODO: Implement Mailgun API call
	return EmailSendResult{Success: false, Error: "Mailgun not implemented"}, fmt.Errorf("mailgun not implemented")
}

// generateBirthdayTestHTML generates HTML content for birthday test card using the new template system
func generateBirthdayTestHTML(input BirthdayTestWorkflowInput) string {
	// Parse custom theme data
	customThemeData := ParseCustomThemeData(input.CustomThemeData)

	// Determine template type
	templateId := TemplateDefault
	switch strings.ToLower(input.EmailTemplate) {
	case "confetti":
		templateId = TemplateConfetti
	case "balloons":
		templateId = TemplateBalloons
	case "custom":
		templateId = TemplateCustom
	default:
		templateId = TemplateDefault
	}

	// Prepare recipient name (combine first and last name for placeholder processing)
	recipientName := input.UserFirstName
	if input.UserLastName != "" {
		if recipientName != "" {
			recipientName += " " + input.UserLastName
		} else {
			recipientName = input.UserLastName
		}
	}

	// Extract unsubscribe token from custom theme data (passed from workflow)
	var unsubscribeToken string
	if input.CustomThemeData != nil {
		if tokenValue, ok := input.CustomThemeData["unsubscribeToken"]; ok {
			if tokenStr, ok := tokenValue.(string); ok {
				unsubscribeToken = tokenStr
				if len(unsubscribeToken) > 16 {
					fmt.Printf("✅ [generateBirthdayTestHTML] Found unsubscribe token: %s...\n", unsubscribeToken[:16])
				} else if len(unsubscribeToken) > 0 {
					fmt.Printf("✅ [generateBirthdayTestHTML] Found unsubscribe token (length: %d)\n", len(unsubscribeToken))
				} else {
					fmt.Println("⚠️  [generateBirthdayTestHTML] unsubscribeToken is empty string")
				}
			} else {
				fmt.Printf("⚠️  [generateBirthdayTestHTML] unsubscribeToken exists but is not a string: %T\n", tokenValue)
			}
		} else {
			fmt.Printf("⚠️  [generateBirthdayTestHTML] unsubscribeToken not found in CustomThemeData. Keys: %v\n", getKeys(input.CustomThemeData))
		}
	} else {
		fmt.Println("⚠️  [generateBirthdayTestHTML] CustomThemeData is nil")
	}

	// Prepare template parameters - NO PROMOTION DATA (for split email flow)
	params := TemplateParams{
		RecipientName:        recipientName,
		Message:              input.CustomMessage,
		BrandName:            input.TenantName,
		CustomThemeData:      customThemeData,
		SenderName:           input.SenderName,
		PromotionContent:     "", // Empty - promotion sent separately
		PromotionTitle:       "",
		PromotionDescription: "",
		IsTest:               input.IsTest,
		UnsubscribeToken:     unsubscribeToken,
	}

	// Render the template
	return RenderBirthdayTemplate(templateId, params)
}

// generateBirthdayTestHTMLWithPromotion generates HTML content for birthday test card with promotion data
func generateBirthdayTestHTMLWithPromotion(input BirthdayTestWorkflowInput, promotion *models.Promotion) string {
	// Parse custom theme data
	customThemeData := ParseCustomThemeData(input.CustomThemeData)

	// Determine template type
	templateId := TemplateDefault
	switch strings.ToLower(input.EmailTemplate) {
	case "confetti":
		templateId = TemplateConfetti
	case "balloons":
		templateId = TemplateBalloons
	case "custom":
		templateId = TemplateCustom
	default:
		templateId = TemplateDefault
	}

	// Prepare recipient name (combine first and last name for placeholder processing)
	recipientName := input.UserFirstName
	if input.UserLastName != "" {
		if recipientName != "" {
			recipientName += " " + input.UserLastName
		} else {
			recipientName = input.UserLastName
		}
	}

	// Extract unsubscribe token from custom theme data (passed from workflow)
	var unsubscribeToken string
	if input.CustomThemeData != nil {
		if tokenValue, ok := input.CustomThemeData["unsubscribeToken"]; ok {
			if tokenStr, ok := tokenValue.(string); ok {
				unsubscribeToken = tokenStr
				if len(unsubscribeToken) > 16 {
					fmt.Printf("✅ [generateBirthdayTestHTMLWithPromotion] Found unsubscribe token: %s...\n", unsubscribeToken[:16])
				} else if len(unsubscribeToken) > 0 {
					fmt.Printf("✅ [generateBirthdayTestHTMLWithPromotion] Found unsubscribe token (length: %d)\n", len(unsubscribeToken))
				} else {
					fmt.Println("⚠️  [generateBirthdayTestHTMLWithPromotion] unsubscribeToken is empty string")
				}
			} else {
				fmt.Printf("⚠️  [generateBirthdayTestHTMLWithPromotion] unsubscribeToken exists but is not a string: %T\n", tokenValue)
			}
		} else {
			fmt.Printf("⚠️  [generateBirthdayTestHTMLWithPromotion] unsubscribeToken not found in CustomThemeData. Keys: %v\n", getKeys(input.CustomThemeData))
		}
	} else {
		fmt.Println("⚠️  [generateBirthdayTestHTMLWithPromotion] CustomThemeData is nil")
	}

	// Prepare template parameters with promotion data
	params := TemplateParams{
		RecipientName:    recipientName,
		Message:          input.CustomMessage,
		BrandName:        input.TenantName,
		CustomThemeData:  customThemeData,
		SenderName:       input.SenderName,
		IsTest:           input.IsTest,
		UnsubscribeToken: unsubscribeToken,
	}

	// Add promotion data if available
	if promotion != nil {
		params.PromotionContent = promotion.Content
		params.PromotionTitle = promotion.Title
		if promotion.Description != nil {
			params.PromotionDescription = *promotion.Description
		}
	}

	// Render the template
	fmt.Printf("🎨 [generateBirthdayTestHTMLWithPromotion] Rendering template with UnsubscribeToken: %v\n", params.UnsubscribeToken != "")
	return RenderBirthdayTemplate(templateId, params)
}

// Helper function to get map keys for debugging
func getKeys(m map[string]interface{}) []string {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	return keys
}

// generateBirthdayInvitationHTML generates HTML content for birthday invitation matching server-node style
func generateBirthdayInvitationHTML(input PrepareEmailInput) string {
	contactName := input.ContactFirstName
	if input.ContactLastName != "" {
		contactName += " " + input.ContactLastName
	}
	if contactName == "" {
		contactName = "Valued Customer"
	}

	return fmt.Sprintf(`
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Birthday Information Request</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #e91e63; margin: 0;">🎂 Birthday Celebration!</h1>
    </div>
    
    <div style="background: #f9f9f9; padding: 25px; border-radius: 8px; margin-bottom: 20px;">
        <p style="margin: 0 0 15px 0; font-size: 16px;">Hi %s,</p>
        
        <p style="margin: 0 0 15px 0;">We'd love to make your birthday extra special! To ensure you don't miss out on exclusive birthday promotions, special offers, and personalized birthday surprises, we'd like to add your birthday to our records.</p>
        
        <p style="margin: 0 0 20px 0;">By sharing your birthday with us, you'll receive:</p>
        
        <ul style="margin: 0 0 20px 20px; padding: 0;">
            <li>🎁 Exclusive birthday discounts and offers</li>
            <li>🎉 Special birthday promotions</li>
            <li>📧 Personalized birthday messages</li>
            <li>🌟 Early access to birthday-themed content</li>
        </ul>
        
        <div style="text-align: center; margin: 25px 0;">
            <a href="%s/birthday-update?token=%s" 
               style="background: linear-gradient(135deg, #e91e63, #f06292); 
                      color: white; 
                      padding: 12px 30px; 
                      text-decoration: none; 
                      border-radius: 25px; 
                      font-weight: bold; 
                      display: inline-block; 
                      box-shadow: 0 4px 8px rgba(233, 30, 99, 0.3);">
                🎂 Add My Birthday
            </a>
        </div>
        
        <p style="margin: 15px 0 0 0; font-size: 14px; color: #666;">This link will expire in 30 days. Your privacy is important to us - we'll only use your birthday to send you special offers and birthday wishes.</p>
    </div>
    
    <div style="border-top: 1px solid #eee; padding-top: 20px; font-size: 12px; color: #888; text-align: center;">
        <p style="margin: 0;">Best regards,<br>%s</p>
        <p style="margin: 10px 0 0 0;">This invitation was sent because you're a valued customer. If you'd prefer not to receive birthday-related communications, you can simply ignore this email.</p>
    </div>
</body>
</html>`,
		template.HTMLEscapeString(contactName),
		input.BaseURL,
		input.InvitationToken,
		template.HTMLEscapeString(input.TenantName),
	)
}

// PreparePromotionalEmail prepares a promotional email to be sent separately
func PreparePromotionalEmail(ctx context.Context, input PreparePromotionalEmailInput) (EmailContent, error) {
	logger := activity.GetLogger(ctx)
	logger.Info("📧 Preparing promotional email",
		"email", input.ToEmail,
		"promotionId", input.Promotion.ID,
		"promotionTitle", input.Promotion.Title)

	// Generate promotional email HTML
	htmlBody := generatePromotionalHTML(input)

	// Handle optional description field
	description := ""
	if input.Promotion.Description != nil {
		description = *input.Promotion.Description
	}

	return EmailContent{
		To:          input.ToEmail,
		From:        input.FromEmail,
		Subject:     fmt.Sprintf("🎁 Special Offer: %s", input.Promotion.Title),
		HTMLContent: htmlBody,
		TextContent: fmt.Sprintf("Special Offer: %s\n\n%s", input.Promotion.Title, description),
	}, nil
}

// SendPromotionalEmail sends the promotional email
func SendPromotionalEmail(ctx context.Context, content EmailContent, tenantID string, promotionID string) (EmailSendResult, error) {
	logger := activity.GetLogger(ctx)
	logger.Info("📤 Sending promotional email", "to", content.To, "subject", content.Subject, "tenantId", tenantID, "promotionId", promotionID)

	// Record activity heartbeat
	activity.RecordHeartbeat(ctx, "Sending promotional email")

	// Use the same email sending logic as birthday emails with promotional email type
	result, err := SendBirthdayTestEmail(ctx, content, tenantID, "promotional")
	if err != nil {
		logger.Error("Failed to send promotional email", "error", err)
		return EmailSendResult{
			Success:   false,
			Error:     err.Error(),
			Provider:  "resend",
			MessageID: "",
		}, err
	}

	logger.Info("✅ Promotional email sent successfully",
		"messageId", result.MessageID,
		"provider", result.Provider)

	return result, nil
}

// generatePromotionalHTML generates the HTML content for the promotional email
func generatePromotionalHTML(input PreparePromotionalEmailInput) string {
	unsubscribeURL := ""
	if input.UnsubscribeToken != "" {
		unsubscribeURL = fmt.Sprintf("%s/api/birthday/unsubscribe/%s",
			"https://app.example.com",
			input.UnsubscribeToken)
	}

	return fmt.Sprintf(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>%s</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
    <table role="presentation" style="width: 100%%; border-collapse: collapse;">
        <tr>
            <td align="center" style="padding: 40px 0;">
                <table role="presentation" style="width: 600px; border-collapse: collapse; background-color: #ffffff; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                    <!-- Header -->
                    <tr>
                        <td style="padding: 40px 40px 20px; text-align: center; background: linear-gradient(135deg, #667eea 0%%, #764ba2 100%%);">
                            <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: bold;">🎁 Special Offer</h1>
                        </td>
                    </tr>
                    
                    <!-- Content -->
                    <tr>
                        <td style="padding: 40px;">
                            <h2 style="margin: 0 0 20px; color: #333333; font-size: 24px;">%s</h2>
                            <div style="color: #666666; font-size: 16px; line-height: 1.6; margin-bottom: 30px;">
                                %s
                            </div>
                            
                            <!-- CTA Button -->
                            <div style="text-align: center; margin: 30px 0;">
                                <a href="#" style="display: inline-block; padding: 15px 40px; background: linear-gradient(135deg, #667eea 0%%, #764ba2 100%%); color: #ffffff; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px;">
                                    Claim Your Offer
                                </a>
                            </div>
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td style="padding: 30px 40px; background-color: #f8f9fa; border-top: 1px solid #e9ecef;">
                            <p style="margin: 0 0 10px; color: #6c757d; font-size: 14px; text-align: center;">
                                %s
                            </p>
                            %s
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>`,
		input.Promotion.Title,
		input.Promotion.Title,
		input.Promotion.Content,
		input.BusinessName,
		func() string {
			if unsubscribeURL != "" {
				return fmt.Sprintf(`<p style="margin: 0; color: #6c757d; font-size: 12px; text-align: center;">
                    <a href="%s" style="color: #6c757d; text-decoration: underline;">Unsubscribe from birthday emails</a>
                </p>`, unsubscribeURL)
			}
			return ""
		}())
}

// InsertOutgoingEmailInput represents input for inserting outgoing email record
type InsertOutgoingEmailInput struct {
	TenantID       string                 `json:"tenantId"`
	RecipientEmail string                 `json:"recipientEmail"`
	RecipientName  *string                `json:"recipientName,omitempty"`
	SenderEmail    string                 `json:"senderEmail"`
	SenderName     *string                `json::"senderName,omitempty"`
	Subject        string                 `json:"subject"`
	EmailType      string                 `json:"emailType"` // 'birthday_card', 'test_card', 'promotional', 'newsletter', 'invitation', 'appointment_reminder'
	Provider       string                 `json:"provider"`  // 'resend', 'sendgrid', 'mailgun', 'other'
	HTMLContent    string                 `json:"htmlContent"`
	TextContent    string                 `json:"textContent"`
	ContactID      *string                `json:"contactId,omitempty"`
	NewsletterID   *string                `json:"newsletterId,omitempty"`
	CampaignID     *string                `json:"campaignId,omitempty"`
	PromotionID    *string                `json:"promotionId,omitempty"`
	Metadata       map[string]interface{} `json:"metadata,omitempty"`
}

// InsertOutgoingEmailResult represents the result of inserting outgoing email
type InsertOutgoingEmailResult struct {
	Success       bool   `json:"success"`
	OutgoingEmailID   *string `json:"outgoingEmailId,omitempty"`
	Error         string `json:"error,omitempty"`
}

// InsertOutgoingEmail creates an initial record in the new split table structure
// This is called BEFORE sending the email, so provider_message_id is left NULL
func InsertOutgoingEmail(ctx context.Context, input InsertOutgoingEmailInput) (InsertOutgoingEmailResult, error) {
	logger := activity.GetLogger(ctx)
	logger.Info("📝 Inserting email record using new split table structure (pre-send)", 
		"recipient", input.RecipientEmail,
		"tenantId", input.TenantID,
		"emailType", input.EmailType,
		"provider", input.Provider)

	if activityDeps == nil || activityDeps.Repo == nil {
		err := fmt.Errorf("activity dependencies not initialized")
		logger.Error("❌ Failed to insert email record", "error", err)
		return InsertOutgoingEmailResult{
			Success: false,
			Error:   err.Error(),
		}, err
	}

	// Serialize metadata if provided
	var metadataJSON *string
	if input.Metadata != nil && len(input.Metadata) > 0 {
		if jsonBytes, err := json.Marshal(input.Metadata); err == nil {
			metadataStr := string(jsonBytes)
			metadataJSON = &metadataStr
		}
	}

	// Create the complete email record using new split table structure
	// provider_message_id is left NULL since we haven't sent yet
	req := &models.CreateCompleteEmailRequest{
		TenantID:          input.TenantID,
		RecipientEmail:    input.RecipientEmail,
		RecipientName:     input.RecipientName,
		SenderEmail:       input.SenderEmail,
		SenderName:        input.SenderName,
		Subject:           input.Subject,
		EmailType:         input.EmailType,
		Provider:          input.Provider,
		ProviderMessageID: nil, // NULL - will be updated after email is sent
		Status:            "pending",
		SendAttempts:      0,
		ErrorMessage:      nil,
		ContactID:         input.ContactID,
		NewsletterID:      input.NewsletterID,
		CampaignID:        input.CampaignID,
		PromotionID:       input.PromotionID,
		HTMLContent:       &input.HTMLContent,
		TextContent:       &input.TextContent,
		Metadata:          metadataJSON,
	}

	logger.Info("📤 Saving email to new split table structure (status=pending)",
		"tenantId", req.TenantID,
		"emailType", req.EmailType,
		"provider", req.Provider,
		"status", req.Status)

	emailSendWithDetails, err := activityDeps.Repo.CreateCompleteEmail(ctx, req)
	if err != nil {
		logger.Error("❌ Failed to insert email record using split tables",
			"error", err,
			"recipient", input.RecipientEmail,
			"tenantId", input.TenantID)
		return InsertOutgoingEmailResult{
			Success: false,
			Error:   err.Error(),
		}, err
	}

	contentID := "none"
	if emailSendWithDetails.Content != nil {
		contentID = emailSendWithDetails.Content.ID
	}
	
	logger.Info("✅ Successfully inserted email record using split tables",
		"emailSendId", emailSendWithDetails.EmailSend.ID,
		"contentId", contentID,
		"recipient", input.RecipientEmail,
		"tenantId", input.TenantID,
		"status", "pending")

	return InsertOutgoingEmailResult{
		Success:         true,
		OutgoingEmailID: &emailSendWithDetails.EmailSend.ID, // Return the email_send ID
	}, nil
}

// GetCompanyNameInput represents input for getting company name
type GetCompanyNameInput struct {
	TenantID string `json:"tenantId"`
}

// GetCompanyNameResult represents the result of getting company name
type GetCompanyNameResult struct {
	Success     bool   `json:"success"`
	CompanyName string `json:"companyName,omitempty"`
	Error       string `json:"error,omitempty"`
}

// GetCompanyNameActivity fetches the company name for a given tenant ID
func GetCompanyNameActivity(ctx context.Context, input GetCompanyNameInput) (GetCompanyNameResult, error) {
	logger := activity.GetLogger(ctx)
	logger.Info("🏢 Fetching company name", "tenantId", input.TenantID)

	if input.TenantID == "" {
		return GetCompanyNameResult{
			Success: false,
			Error:   "Tenant ID is required",
		}, fmt.Errorf("tenant ID is required")
	}

	company, err := activityDeps.Repo.GetCompany(ctx, input.TenantID)
	if err != nil {
		logger.Error("Failed to fetch company", "error", err)
		return GetCompanyNameResult{
			Success: false,
			Error:   "Failed to fetch company",
		}, fmt.Errorf("failed to fetch company: %w", err)
	}

	if company == nil || company.Name == "" {
		logger.Info("No company found or name is empty", "tenantId", input.TenantID)
		return GetCompanyNameResult{
			Success: false,
			Error:   "Company not found or name is empty",
		}, fmt.Errorf("company not found or name is empty")
	}

	logger.Info("✅ Company name fetched successfully", "companyName", company.Name)
	return GetCompanyNameResult{
		Success:     true,
		CompanyName: company.Name,
	}, nil
}
