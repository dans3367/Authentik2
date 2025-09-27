package temporal

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"html/template"
	"net/http"
	"strings"
	"time"

	"cardprocessor-go/internal/config"
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

// TokenInput represents input for token generation
type TokenInput struct {
	ContactID string `json:"contactId"`
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

// PrepareBirthdayTestEmail prepares birthday test email content
func PrepareBirthdayTestEmail(ctx context.Context, input BirthdayTestWorkflowInput) (EmailContent, error) {
	logger := activity.GetLogger(ctx)
	logger.Info("📧 Preparing birthday test email", "userId", input.UserID, "email", input.UserEmail)

	// Generate HTML content for birthday test card
	htmlContent := generateBirthdayTestHTML(input)

	// Generate text content (simplified version)
	textContent := fmt.Sprintf("Happy Birthday %s!\n\n%s\n\nBest regards,\n%s",
		input.UserFirstName, input.CustomMessage, input.SenderName)

	return EmailContent{
		Subject:     fmt.Sprintf("🎉 Happy Birthday %s! (Test - %s template)", input.UserFirstName, input.EmailTemplate),
		HTMLContent: htmlContent,
		TextContent: textContent,
		To:          input.UserEmail,
		From:        input.FromEmail,
	}, nil
}

// SendBirthdayTestEmail sends birthday test email
func SendBirthdayTestEmail(ctx context.Context, content EmailContent) (EmailSendResult, error) {
	logger := activity.GetLogger(ctx)
	logger.Info("📤 Sending birthday test email", "to", content.To)

	// Try different email providers in order of preference
	providers := []string{"resend", "sendgrid", "mailgun"}

	for _, provider := range providers {
		result, err := sendEmailViaProvider(ctx, provider, content)
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
	logger.Info("📤 Sending birthday invitation email", "to", input.To)

	content := EmailContent{
		Subject:     input.Subject,
		HTMLContent: input.HTMLContent,
		TextContent: input.TextContent,
		To:          input.To,
		From:        input.From,
	}

	// Try different email providers in order of preference
	providers := []string{"resend", "sendgrid", "mailgun"}

	for _, provider := range providers {
		result, err := sendEmailViaProvider(ctx, provider, content)
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

// sendEmailViaProvider sends email via a specific provider
func sendEmailViaProvider(ctx context.Context, provider string, content EmailContent) (EmailSendResult, error) {
	switch provider {
	case "resend":
		return sendViaResend(ctx, content)
	case "sendgrid":
		return sendViaSendGrid(ctx, content)
	case "mailgun":
		return sendViaMailgun(ctx, content)
	default:
		return EmailSendResult{Success: false, Error: "Unknown provider"}, fmt.Errorf("unknown provider: %s", provider)
	}
}

// sendViaResend sends email via Resend API
func sendViaResend(ctx context.Context, content EmailContent) (EmailSendResult, error) {
	if activityDeps.Config.ResendAPIKey == "" {
		return EmailSendResult{Success: false, Error: "Resend API key not configured"}, fmt.Errorf("resend API key not configured")
	}

	payload := map[string]interface{}{
		"from":    content.From,
		"to":      []string{content.To},
		"subject": content.Subject,
		"html":    content.HTMLContent,
		"text":    content.TextContent,
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

	if resp.StatusCode != 200 {
		return EmailSendResult{Success: false, Error: "Resend API error"}, fmt.Errorf("resend API returned status %d", resp.StatusCode)
	}

	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)

	return EmailSendResult{
		Success:   true,
		MessageID: result["id"].(string),
		Provider:  "resend",
	}, nil
}

// sendViaSendGrid sends email via SendGrid API
func sendViaSendGrid(ctx context.Context, content EmailContent) (EmailSendResult, error) {
	if activityDeps.Config.SendGridAPIKey == "" {
		return EmailSendResult{Success: false, Error: "SendGrid API key not configured"}, fmt.Errorf("sendgrid API key not configured")
	}

	// TODO: Implement SendGrid API call
	return EmailSendResult{Success: false, Error: "SendGrid not implemented"}, fmt.Errorf("sendgrid not implemented")
}

// sendViaMailgun sends email via Mailgun API
func sendViaMailgun(ctx context.Context, content EmailContent) (EmailSendResult, error) {
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

	// Prepare template parameters
	params := TemplateParams{
		RecipientName:        input.UserFirstName,
		Message:              input.CustomMessage,
		BrandName:            input.TenantName,
		CustomThemeData:      customThemeData,
		SenderName:           input.SenderName,
		PromotionContent:     "", // TODO: Add promotion support
		PromotionTitle:       "",
		PromotionDescription: "",
		IsTest:               input.IsTest,
	}

	// Render the template
	return RenderBirthdayTemplate(templateId, params)
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
