package activities

import (
	"context"
	"fmt"
	"net/url"
	"strings"
	"time"

	"email-tracking-server/pkg/logger"

	"github.com/golang-jwt/jwt/v5"
	"github.com/resend/resend-go/v2"
	"go.temporal.io/sdk/activity"
)

type EmailActivity struct {
	resendClient *resend.Client
	fromEmail    string
	logger       *logger.Logger
	jwtSecret    string
	approveBase  string
}

type EmailData struct {
	ID        string                 `json:"id"`
	UserID    string                 `json:"userId"`
	TenantID  string                 `json:"tenantId"`
	EmailID   string                 `json:"emailId"`
	Status    string                 `json:"status"`
	Timestamp time.Time              `json:"timestamp"`
	Workflow  string                 `json:"temporalWorkflow,omitempty"`
	Metadata  map[string]interface{} `json:"metadata,omitempty"`
}

type SendEmailRequest struct {
	To       string `json:"to"`
	Subject  string `json:"subject"`
	Content  string `json:"content"`
	Priority string `json:"priority"`
	Template string `json:"template"`
}

type SendEmailResult struct {
	EmailID  string    `json:"emailId"`
	ResendID string    `json:"resendId"`
	Status   string    `json:"status"`
	SentAt   time.Time `json:"sentAt"`
	Error    string    `json:"error,omitempty"`
}

func NewEmailActivity(apiKey string, fromEmail string, jwtSecret string, approveBaseURL string, log *logger.Logger) *EmailActivity {
	resendClient := resend.NewClient(apiKey)

	return &EmailActivity{
		resendClient: resendClient,
		fromEmail:    fromEmail,
		logger:       log,
		jwtSecret:    jwtSecret,
		approveBase:  approveBaseURL,
	}
}

func (ea *EmailActivity) SendEmail(ctx context.Context, emailData EmailData) (*SendEmailResult, error) {
	logger := ea.logger.WithEmail(emailData.EmailID).WithContext(ctx)
	logger.Info("Starting email send activity", "recipient", emailData.Metadata["recipient"])

	// Extract email details from metadata
	recipient, ok := emailData.Metadata["recipient"].(string)
	if !ok || recipient == "" {
		err := fmt.Errorf("recipient not found or invalid in metadata")
		logger.Error("Invalid recipient", "error", err)
		return &SendEmailResult{
			EmailID: emailData.EmailID,
			Status:  "failed",
			SentAt:  time.Now(),
			Error:   err.Error(),
		}, err
	}

	subject, ok := emailData.Metadata["subject"].(string)
	if !ok || subject == "" {
		err := fmt.Errorf("subject not found or invalid in metadata")
		logger.Error("Invalid subject", "error", err)
		return &SendEmailResult{
			EmailID: emailData.EmailID,
			Status:  "failed",
			SentAt:  time.Now(),
			Error:   err.Error(),
		}, err
	}

	content, ok := emailData.Metadata["content"].(string)
	if !ok || content == "" {
		err := fmt.Errorf("content not found or invalid in metadata")
		logger.Error("Invalid content", "error", err)
		return &SendEmailResult{
			EmailID: emailData.EmailID,
			Status:  "failed",
			SentAt:  time.Now(),
			Error:   err.Error(),
		}, err
	}

	// Get template type and priority if available
	templateType, _ := emailData.Metadata["templateType"].(string)
	priority, _ := emailData.Metadata["priority"].(string)

	// Extract tags from metadata for Resend tracking
	var tags []resend.Tag
	if tagsInterface, exists := emailData.Metadata["tags"]; exists {
		if tagsSlice, ok := tagsInterface.([]interface{}); ok {
			for _, tag := range tagsSlice {
				if tagStr, ok := tag.(string); ok {
					// Parse groupUUID tags specially to create proper key-value pairs
					if strings.HasPrefix(tagStr, "groupUUID-") {
						groupUUID := strings.TrimPrefix(tagStr, "groupUUID-")
						tags = append(tags, resend.Tag{
							Name:  "groupUUID",
							Value: groupUUID,
						})
						logger.Info("Added groupUUID tag", "groupUUID", groupUUID)
					} else {
						// For other tags, use a unique tag name to avoid duplicates
						// Resend only allows ASCII letters, numbers, underscores, or dashes
						sanitizedValue := strings.ReplaceAll(tagStr, " ", "_")
						// Remove any other invalid characters (keep only letters, numbers, underscores, dashes)
						sanitizedValue = strings.Map(func(r rune) rune {
							if (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') ||
								(r >= '0' && r <= '9') || r == '_' || r == '-' {
								return r
							}
							return '_'
						}, sanitizedValue)

						// Use a unique tag name based on the content type
						var tagName string
						if strings.HasPrefix(tagStr, "newsletter-") {
							tagName = "newsletter_id"
						} else if tagStr == "newsletter" {
							tagName = "type"
						} else {
							tagName = "title"
						}

						tags = append(tags, resend.Tag{
							Name:  tagName,
							Value: sanitizedValue,
						})
					}
				}
			}
		}
	}

	logger.Info("Sending email via Resend",
		"to", recipient,
		"subject", subject,
		"template", templateType,
		"priority", priority,
		"tags_count", len(tags))

	// Create email request for Resend
	params := &resend.SendEmailRequest{
		From:    ea.fromEmail,
		To:      []string{recipient},
		Subject: subject,
		Html:    ea.formatEmailContent(content, templateType),
		Tags:    tags,
	}

	// Add activity heartbeat for long-running operations
	activity.RecordHeartbeat(ctx, "Sending email via Resend")

	// Send email via Resend
	sent, err := ea.resendClient.Emails.Send(params)
	if err != nil {
		logger.Error("Failed to send email via Resend", "error", err)
		return &SendEmailResult{
			EmailID: emailData.EmailID,
			Status:  "failed",
			SentAt:  time.Now(),
			Error:   err.Error(),
		}, err
	}

	logger.Info("Successfully sent email via Resend",
		"resend_id", sent.Id,
		"recipient", recipient)

	return &SendEmailResult{
		EmailID:  emailData.EmailID,
		ResendID: sent.Id,
		Status:   "sent",
		SentAt:   time.Now(),
	}, nil
}

// SendApprovalEmail sends an approval request email to the reviewer with a signed approval link.
// It expects the following metadata in EmailData:
// - reviewerEmail (string): email address of the reviewer
// - subject (string, optional): subject of the campaign being reviewed
// If reviewerEmail is not provided, the activity logs a warning and returns a non-fatal result,
// allowing the workflow to continue waiting for approval.
func (ea *EmailActivity) SendApprovalEmail(ctx context.Context, emailData EmailData) (*SendEmailResult, error) {
	logger := ea.logger.WithEmail(emailData.EmailID).WithContext(ctx)
	logger.Info("Starting approval email activity")

	// Validate configuration
	if ea.jwtSecret == "" {
		err := fmt.Errorf("jwt secret not configured in worker")
		logger.Error("Missing JWT secret", "error", err)
		return &SendEmailResult{EmailID: emailData.EmailID, Status: "approval_email_failed", SentAt: time.Now(), Error: err.Error()}, err
	}

	// Extract reviewer email
	var reviewerEmail string
	if emailData.Metadata != nil {
		if v, ok := emailData.Metadata["reviewerEmail"].(string); ok {
			reviewerEmail = v
		}
	}

	if reviewerEmail == "" {
		// Non-fatal: keep awaiting approval; UI can trigger resend via Node API
		logger.Warn("No reviewerEmail in metadata; skipping approval email send")
		return &SendEmailResult{
			EmailID: emailData.EmailID,
			Status:  "awaiting_approval",
			SentAt:  time.Now(),
			Error:   "reviewerEmail not provided; approval email skipped",
		}, nil
	}

	// Compose token with emailId and expected workflowId convention
	workflowID := fmt.Sprintf("reviewer-email-workflow-%s", emailData.EmailID)

	type ApprovalClaims struct {
		EmailID    string `json:"emailId"`
		WorkflowID string `json:"workflowId"`
		jwt.RegisteredClaims
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, ApprovalClaims{
		EmailID:    emailData.EmailID,
		WorkflowID: workflowID,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(7 * 24 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	})

	signed, err := token.SignedString([]byte(ea.jwtSecret))
	if err != nil {
		logger.Error("Failed to sign approval token", "error", err)
		return &SendEmailResult{EmailID: emailData.EmailID, Status: "approval_email_failed", SentAt: time.Now(), Error: err.Error()}, err
	}

	base := ea.approveBase
	if base == "" {
		base = "https://tenginew.zendwise.work"
	}
	approveURL := fmt.Sprintf("%s/approve-email?token=%s", base, url.QueryEscape(signed))

	// Subject and content
	subject, _ := emailData.Metadata["subject"].(string)
	if subject == "" {
		subject = "Email campaign"
	}
	approvalSubject := fmt.Sprintf("Review required: %s", subject)
	html := fmt.Sprintf(`<p>You have a pending email campaign awaiting your approval.</p>
<p><a href="%s" style="display:inline-block;padding:10px 16px;background:#4f46e5;color:white;border-radius:6px;text-decoration:none;">Approve Email</a></p>
<p>If the button doesn't work, click or copy this link:</p>
<p>%s</p>`, approveURL, approveURL)

	// Heartbeat and send
	activity.RecordHeartbeat(ctx, "Sending approval email via Resend")
	params := &resend.SendEmailRequest{
		From:    ea.fromEmail,
		To:      []string{reviewerEmail},
		Subject: approvalSubject,
		Html:    html,
	}
	sent, sendErr := ea.resendClient.Emails.Send(params)
	if sendErr != nil {
		logger.Error("Failed to send approval email via Resend", "error", sendErr)
		return &SendEmailResult{EmailID: emailData.EmailID, Status: "approval_email_failed", SentAt: time.Now(), Error: sendErr.Error()}, sendErr
	}

	logger.Info("Approval email sent", "resend_id", sent.Id, "reviewer", reviewerEmail)
	return &SendEmailResult{EmailID: emailData.EmailID, ResendID: sent.Id, Status: "awaiting_approval", SentAt: time.Now()}, nil
}

// SendReviewerNotificationEmail sends a notification email to a reviewer when an email requires approval.
// This activity is triggered as part of the email workflow when reviewer approval is required.
func (ea *EmailActivity) SendReviewerNotificationEmail(ctx context.Context, emailData EmailData) (*SendEmailResult, error) {
	logger := ea.logger.WithEmail(emailData.EmailID).WithContext(ctx)
	logger.Info("Starting reviewer notification email activity")

	// Validate configuration
	if ea.jwtSecret == "" {
		err := fmt.Errorf("jwt secret not configured in worker")
		logger.Error("Missing JWT secret", "error", err)
		return &SendEmailResult{EmailID: emailData.EmailID, Status: "reviewer_notification_failed", SentAt: time.Now(), Error: err.Error()}, err
	}

	// Extract reviewer email from metadata
	var reviewerEmail string
	if emailData.Metadata != nil {
		if v, ok := emailData.Metadata["reviewerEmail"].(string); ok {
			reviewerEmail = v
		}
	}

	if reviewerEmail == "" {
		// Non-fatal: return success but log warning
		logger.Warn("No reviewerEmail in metadata; skipping reviewer notification")
		return &SendEmailResult{
			EmailID: emailData.EmailID,
			Status:  "reviewer_notification_skipped",
			SentAt:  time.Now(),
			Error:   "reviewerEmail not provided; reviewer notification skipped",
		}, nil
	}

	// Generate JWT token for approval link
	workflowID := fmt.Sprintf("reviewer-email-workflow-%s", emailData.EmailID)

	type ApprovalClaims struct {
		EmailID    string `json:"emailId"`
		WorkflowID string `json:"workflowId"`
		jwt.RegisteredClaims
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, ApprovalClaims{
		EmailID:    emailData.EmailID,
		WorkflowID: workflowID,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(7 * 24 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	})

	signed, err := token.SignedString([]byte(ea.jwtSecret))
	if err != nil {
		logger.Error("Failed to sign approval token", "error", err)
		return &SendEmailResult{EmailID: emailData.EmailID, Status: "reviewer_notification_failed", SentAt: time.Now(), Error: err.Error()}, err
	}

	base := ea.approveBase
	if base == "" {
		base = "https://tenginew.zendwise.work"
	}
	approveURL := fmt.Sprintf("%s/approve-email?token=%s", base, url.QueryEscape(signed))

	// Extract campaign details for email content
	subject, _ := emailData.Metadata["subject"].(string)
	if subject == "" {
		subject = "Email campaign"
	}

	campaignContent, _ := emailData.Metadata["content"].(string)
	campaignTo, _ := emailData.Metadata["to"].(string)

	approvalSubject := fmt.Sprintf("Review Required: %s", subject)

	// Enhanced HTML email template
	html := fmt.Sprintf(`
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Email Campaign Approval Required</title>
            <style>
                body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #4f46e5 0%%, #7c3aed 100%%); color: white; padding: 24px; text-align: center; border-radius: 8px 8px 0 0; }
                .content { background: #f8f9fa; padding: 24px; border-radius: 0 0 8px 8px; }
                .campaign-preview { background: white; border: 1px solid #dee2e6; border-radius: 6px; padding: 16px; margin: 16px 0; }
                .button { display: inline-block; background: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 16px 0; }
                .button:hover { background: #3730a3; }
                .footer { text-align: center; margin-top: 20px; color: #666; font-size: 14px; }
                .detail-row { margin: 8px 0; }
                .label { font-weight: 600; color: #495057; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>📧 Email Campaign Review</h1>
                    <p>Approval Required</p>
                </div>
                <div class="content">
                    <h2>Campaign Details</h2>
                    <div class="detail-row">
                        <span class="label">Subject:</span> %s
                    </div>
                    <div class="detail-row">
                        <span class="label">Recipient:</span> %s
                    </div>
                    <div class="detail-row">
                        <span class="label">Campaign ID:</span> %s
                    </div>
                    
                    <div class="campaign-preview">
                        <h4>Campaign Preview:</h4>
                        <div style="max-height: 200px; overflow-y: auto; padding: 8px; background: #f8f9fa; border-radius: 4px;">
                            %s
                        </div>
                    </div>
                    
                    <div style="text-align: center; margin: 24px 0;">
                        <a href="%s" class="button">✅ Approve Campaign</a>
                    </div>
                    
                    <p><strong>What happens when you approve:</strong></p>
                    <ul>
                        <li>The campaign will be immediately queued for sending</li>
                        <li>Recipients will receive the email within minutes</li>
                        <li>You'll receive a confirmation notification</li>
                    </ul>
                    
                    <p>If the button doesn't work, copy and paste this link into your browser:</p>
                    <p style="background: #e9ecef; padding: 10px; border-radius: 4px; word-break: break-all; font-family: monospace; font-size: 12px;">
                        %s
                    </p>
                    
                    <p><em>This approval link will expire in 7 days.</em></p>
                </div>
                <div class="footer">
                    <p>This approval request was sent to %s</p>
                    <p>Campaign submitted via Authentik Email System</p>
                </div>
            </div>
        </body>
        </html>
    `, subject, campaignTo, emailData.EmailID, campaignContent, approveURL, approveURL, reviewerEmail)

	// Extract tags from metadata for approval email tracking
	var approvalTags []resend.Tag
	if tagsInterface, exists := emailData.Metadata["tags"]; exists {
		if tagsSlice, ok := tagsInterface.([]interface{}); ok {
			for _, tag := range tagsSlice {
				if tagStr, ok := tag.(string); ok {
					// Parse groupUUID tags specially to create proper key-value pairs
					if strings.HasPrefix(tagStr, "groupUUID-") {
						groupUUID := strings.TrimPrefix(tagStr, "groupUUID-")
						approvalTags = append(approvalTags, resend.Tag{
							Name:  "groupUUID",
							Value: groupUUID,
						})
					} else {
						// For other tags, use a unique tag name to avoid duplicates
						// Resend only allows ASCII letters, numbers, underscores, or dashes
						sanitizedValue := strings.ReplaceAll(tagStr, " ", "_")
						// Remove any other invalid characters (keep only letters, numbers, underscores, dashes)
						sanitizedValue = strings.Map(func(r rune) rune {
							if (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') ||
								(r >= '0' && r <= '9') || r == '_' || r == '-' {
								return r
							}
							return '_'
						}, sanitizedValue)

						// Use a unique tag name based on the content type for approval emails
						var tagName string
						if strings.HasPrefix(tagStr, "newsletter-") {
							tagName = "newsletter_id"
						} else if tagStr == "newsletter" {
							tagName = "email_type"
						} else {
							tagName = "campaign_title"
						}

						approvalTags = append(approvalTags, resend.Tag{
							Name:  tagName,
							Value: sanitizedValue,
						})
					}
				}
			}
		}
	}
	// Add approval-specific tag
	approvalTags = append(approvalTags, resend.Tag{
		Name:  "type",
		Value: "approval-request",
	})

	// Send the reviewer notification email
	activity.RecordHeartbeat(ctx, "Sending reviewer notification email via Resend")
	params := &resend.SendEmailRequest{
		From:    ea.fromEmail,
		To:      []string{reviewerEmail},
		Subject: approvalSubject,
		Html:    html,
		Tags:    approvalTags,
	}

	sent, sendErr := ea.resendClient.Emails.Send(params)
	if sendErr != nil {
		logger.Error("Failed to send reviewer notification email via Resend", "error", sendErr)
		return &SendEmailResult{EmailID: emailData.EmailID, Status: "reviewer_notification_failed", SentAt: time.Now(), Error: sendErr.Error()}, sendErr
	}

	logger.Info("Reviewer notification email sent successfully",
		"resend_id", sent.Id,
		"reviewer", reviewerEmail,
		"approval_url", approveURL)

	return &SendEmailResult{
		EmailID:  emailData.EmailID,
		ResendID: sent.Id,
		Status:   "reviewer_notification_sent",
		SentAt:   time.Now(),
	}, nil
}

func (ea *EmailActivity) formatEmailContent(content, templateType string) string {
	// Basic HTML formatting based on template type
	switch templateType {
	case "marketing":
		return fmt.Sprintf(`
			<html>
			<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
				<div style="background: linear-gradient(135deg, #667eea 0%%, #764ba2 100%%); padding: 20px; text-align: center;">
					<h1 style="color: white; margin: 0;">📧 Marketing Email</h1>
				</div>
				<div style="padding: 30px; background: #f9f9f9;">
					<div style="background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
						%s
					</div>
				</div>
				<div style="background: #333; color: white; padding: 15px; text-align: center; font-size: 12px;">
					Sent via Authentik Email Campaign System
				</div>
			</body>
			</html>
		`, content)
	case "transactional":
		return fmt.Sprintf(`
			<html>
			<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
				<div style="border-left: 4px solid #4CAF50; padding: 20px;">
					<h2 style="color: #333; margin-top: 0;">🔄 Transaction Notification</h2>
					<div style="line-height: 1.6; color: #666;">
						%s
					</div>
				</div>
			</body>
			</html>
		`, content)
	case "newsletter":
		return fmt.Sprintf(`
			<html>
			<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
				<div style="background: #2196F3; color: white; padding: 20px; text-align: center;">
					<h1 style="margin: 0;">📰 Newsletter</h1>
				</div>
				<div style="padding: 20px; background: white;">
					%s
				</div>
			</body>
			</html>
		`, content)
	case "notification":
		return fmt.Sprintf(`
			<html>
			<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
				<div style="background: #FF9800; color: white; padding: 15px; border-radius: 4px;">
					<h3 style="margin: 0;">🔔 Notification</h3>
				</div>
				<div style="padding: 20px; border: 1px solid #ddd; border-top: none;">
					%s
				</div>
			</body>
			</html>
		`, content)
	default:
		return fmt.Sprintf(`
			<html>
			<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
				%s
			</body>
			</html>
		`, content)
	}
}
