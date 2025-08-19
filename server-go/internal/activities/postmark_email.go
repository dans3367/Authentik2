package activities

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"

	"email-tracking-server/pkg/logger"

	"github.com/golang-jwt/jwt/v5"
	"go.temporal.io/sdk/activity"
)

type PostmarkEmailActivity struct {
	apiKey      string
	fromEmail   string
	logger      *logger.Logger
	jwtSecret   string
	approveBase string
	httpClient  *http.Client
}

type PostmarkEmailRequest struct {
	From       string            `json:"From"`
	To         string            `json:"To"`
	Subject    string            `json:"Subject"`
	HtmlBody   string            `json:"HtmlBody"`
	TextBody   string            `json:"TextBody,omitempty"`
	Tag        string            `json:"Tag,omitempty"`
	Metadata   map[string]string `json:"Metadata,omitempty"`
	TrackOpens bool              `json:"TrackOpens"`
	TrackLinks string            `json:"TrackLinks"`
}

type PostmarkEmailResponse struct {
	To          string    `json:"To"`
	SubmittedAt time.Time `json:"SubmittedAt"`
	MessageID   string    `json:"MessageID"`
	ErrorCode   int       `json:"ErrorCode"`
	Message     string    `json:"Message"`
}

type PostmarkSendEmailResult struct {
	EmailID    string    `json:"emailId"`
	PostmarkID string    `json:"postmarkId"`
	Status     string    `json:"status"`
	SentAt     time.Time `json:"sentAt"`
	Error      string    `json:"error,omitempty"`
}

func NewPostmarkEmailActivity(apiKey string, fromEmail string, jwtSecret string, approveBaseURL string, log *logger.Logger) *PostmarkEmailActivity {
	return &PostmarkEmailActivity{
		apiKey:      apiKey,
		fromEmail:   fromEmail,
		logger:      log,
		jwtSecret:   jwtSecret,
		approveBase: approveBaseURL,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

func (pea *PostmarkEmailActivity) SendPostmarkEmail(ctx context.Context, emailData EmailData) (*PostmarkSendEmailResult, error) {
	logger := pea.logger.WithEmail(emailData.EmailID).WithContext(ctx)
	logger.Info("Starting Postmark email send activity", "recipient", emailData.Metadata["recipient"])

	// Extract email details from metadata
	recipient, ok := emailData.Metadata["recipient"].(string)
	if !ok || recipient == "" {
		err := fmt.Errorf("recipient not found or invalid in metadata")
		logger.Error("Invalid recipient", "error", err)
		return &PostmarkSendEmailResult{
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
		return &PostmarkSendEmailResult{
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
		return &PostmarkSendEmailResult{
			EmailID: emailData.EmailID,
			Status:  "failed",
			SentAt:  time.Now(),
			Error:   err.Error(),
		}, err
	}

	// Get template type and priority if available
	templateType, _ := emailData.Metadata["templateType"].(string)
	priority, _ := emailData.Metadata["priority"].(string)

	// Create metadata for Postmark tracking
	metadata := make(map[string]string)
	metadata["emailId"] = emailData.EmailID
	metadata["userId"] = emailData.UserID
	metadata["tenantId"] = emailData.TenantID
	if templateType != "" {
		metadata["templateType"] = templateType
	}
	if priority != "" {
		metadata["priority"] = priority
	}

	// Extract tags and create a single tag string for Postmark
	var tag string
	if tagsInterface, exists := emailData.Metadata["tags"]; exists {
		if tagsSlice, ok := tagsInterface.([]interface{}); ok {
			var tags []string
			for _, tagItem := range tagsSlice {
				if tagStr, ok := tagItem.(string); ok {
					// Sanitize tag for Postmark (alphanumeric, dashes, underscores only)
					sanitizedTag := strings.Map(func(r rune) rune {
						if (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') ||
							(r >= '0' && r <= '9') || r == '_' || r == '-' {
							return r
						}
						return '_'
					}, tagStr)
					tags = append(tags, sanitizedTag)
				}
			}
			if len(tags) > 0 {
				tag = strings.Join(tags, ",")
			}
		}
	}

	logger.Info("Sending email via Postmark",
		"to", recipient,
		"subject", subject,
		"template", templateType,
		"priority", priority,
		"tag", tag)

	// Create email request for Postmark
	emailRequest := PostmarkEmailRequest{
		From:       pea.fromEmail,
		To:         recipient,
		Subject:    subject,
		HtmlBody:   pea.formatEmailContent(content, templateType),
		Tag:        tag,
		Metadata:   metadata,
		TrackOpens: true,
		TrackLinks: "HtmlAndText",
	}

	// Add activity heartbeat for long-running operations
	activity.RecordHeartbeat(ctx, "Sending email via Postmark")

	// Send email via Postmark API
	result, err := pea.sendEmailViaPostmark(emailRequest)
	if err != nil {
		logger.Error("Failed to send email via Postmark", "error", err)
		return &PostmarkSendEmailResult{
			EmailID: emailData.EmailID,
			Status:  "failed",
			SentAt:  time.Now(),
			Error:   err.Error(),
		}, err
	}

	if result.ErrorCode != 0 {
		err := fmt.Errorf("postmark API error: %s (code: %d)", result.Message, result.ErrorCode)
		logger.Error("Postmark API returned error", "error", err, "error_code", result.ErrorCode)
		return &PostmarkSendEmailResult{
			EmailID: emailData.EmailID,
			Status:  "failed",
			SentAt:  time.Now(),
			Error:   err.Error(),
		}, err
	}

	logger.Info("Successfully sent email via Postmark",
		"postmark_id", result.MessageID,
		"recipient", recipient)

	return &PostmarkSendEmailResult{
		EmailID:    emailData.EmailID,
		PostmarkID: result.MessageID,
		Status:     "sent",
		SentAt:     result.SubmittedAt,
	}, nil
}

func (pea *PostmarkEmailActivity) SendPostmarkApprovalEmail(ctx context.Context, emailData EmailData) (*PostmarkSendEmailResult, error) {
	logger := pea.logger.WithEmail(emailData.EmailID).WithContext(ctx)
	logger.Info("Starting Postmark approval email activity")

	// Validate configuration
	if pea.jwtSecret == "" {
		err := fmt.Errorf("jwt secret not configured in worker")
		logger.Error("Missing JWT secret", "error", err)
		return &PostmarkSendEmailResult{EmailID: emailData.EmailID, Status: "approval_email_failed", SentAt: time.Now(), Error: err.Error()}, err
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
		return &PostmarkSendEmailResult{
			EmailID: emailData.EmailID,
			Status:  "awaiting_approval",
			SentAt:  time.Now(),
			Error:   "reviewerEmail not provided; approval email skipped",
		}, nil
	}

	// Compose token with emailId and expected workflowId convention
	workflowID := fmt.Sprintf("postmark-reviewer-email-workflow-%s", emailData.EmailID)

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

	signed, err := token.SignedString([]byte(pea.jwtSecret))
	if err != nil {
		logger.Error("Failed to sign approval token", "error", err)
		return &PostmarkSendEmailResult{EmailID: emailData.EmailID, Status: "approval_email_failed", SentAt: time.Now(), Error: err.Error()}, err
	}

	base := pea.approveBase
	if base == "" {
		base = "https://tengine.zendwise.work"
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

	// Create metadata for tracking
	metadata := make(map[string]string)
	metadata["emailId"] = emailData.EmailID
	metadata["type"] = "approval-request"

	emailRequest := PostmarkEmailRequest{
		From:       pea.fromEmail,
		To:         reviewerEmail,
		Subject:    approvalSubject,
		HtmlBody:   html,
		Tag:        "approval-request",
		Metadata:   metadata,
		TrackOpens: true,
		TrackLinks: "HtmlAndText",
	}

	// Heartbeat and send
	activity.RecordHeartbeat(ctx, "Sending approval email via Postmark")
	result, sendErr := pea.sendEmailViaPostmark(emailRequest)
	if sendErr != nil {
		logger.Error("Failed to send approval email via Postmark", "error", sendErr)
		return &PostmarkSendEmailResult{EmailID: emailData.EmailID, Status: "approval_email_failed", SentAt: time.Now(), Error: sendErr.Error()}, sendErr
	}

	if result.ErrorCode != 0 {
		err := fmt.Errorf("postmark API error: %s (code: %d)", result.Message, result.ErrorCode)
		logger.Error("Postmark API returned error for approval email", "error", err)
		return &PostmarkSendEmailResult{EmailID: emailData.EmailID, Status: "approval_email_failed", SentAt: time.Now(), Error: err.Error()}, err
	}

	logger.Info("Approval email sent via Postmark", "postmark_id", result.MessageID, "reviewer", reviewerEmail)
	return &PostmarkSendEmailResult{EmailID: emailData.EmailID, PostmarkID: result.MessageID, Status: "awaiting_approval", SentAt: result.SubmittedAt}, nil
}

func (pea *PostmarkEmailActivity) SendPostmarkReviewerNotificationEmail(ctx context.Context, emailData EmailData) (*PostmarkSendEmailResult, error) {
	logger := pea.logger.WithEmail(emailData.EmailID).WithContext(ctx)
	logger.Info("Starting Postmark reviewer notification email activity")

	// Validate configuration
	if pea.jwtSecret == "" {
		err := fmt.Errorf("jwt secret not configured in worker")
		logger.Error("Missing JWT secret", "error", err)
		return &PostmarkSendEmailResult{EmailID: emailData.EmailID, Status: "reviewer_notification_failed", SentAt: time.Now(), Error: err.Error()}, err
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
		return &PostmarkSendEmailResult{
			EmailID: emailData.EmailID,
			Status:  "reviewer_notification_skipped",
			SentAt:  time.Now(),
			Error:   "reviewerEmail not provided; reviewer notification skipped",
		}, nil
	}

	// Generate JWT token for approval link
	workflowID := fmt.Sprintf("postmark-reviewer-email-workflow-%s", emailData.EmailID)

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

	signed, err := token.SignedString([]byte(pea.jwtSecret))
	if err != nil {
		logger.Error("Failed to sign approval token", "error", err)
		return &PostmarkSendEmailResult{EmailID: emailData.EmailID, Status: "reviewer_notification_failed", SentAt: time.Now(), Error: err.Error()}, err
	}

	base := pea.approveBase
	if base == "" {
		base = "https://tengine.zendwise.work"
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
                .header { background: linear-gradient(135deg, #e83e8c 0%%, #fd7e14 100%%); color: white; padding: 24px; text-align: center; border-radius: 8px 8px 0 0; }
                .content { background: #f8f9fa; padding: 24px; border-radius: 0 0 8px 8px; }
                .campaign-preview { background: white; border: 1px solid #dee2e6; border-radius: 6px; padding: 16px; margin: 16px 0; }
                .button { display: inline-block; background: #e83e8c; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 16px 0; }
                .button:hover { background: #c21765; }
                .footer { text-align: center; margin-top: 20px; color: #666; font-size: 14px; }
                .detail-row { margin: 8px 0; }
                .label { font-weight: 600; color: #495057; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>📧 Email Campaign Review (Postmark)</h1>
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
                    <div class="detail-row">
                        <span class="label">Provider:</span> Postmark
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
                        <li>The campaign will be immediately queued for sending via Postmark</li>
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
                    <p>Campaign submitted via Authentik Email System (Postmark Provider)</p>
                </div>
            </div>
        </body>
        </html>
    `, subject, campaignTo, emailData.EmailID, campaignContent, approveURL, approveURL, reviewerEmail)

	// Create metadata for tracking
	metadata := make(map[string]string)
	metadata["emailId"] = emailData.EmailID
	metadata["type"] = "reviewer-notification"
	metadata["provider"] = "postmark"

	emailRequest := PostmarkEmailRequest{
		From:       pea.fromEmail,
		To:         reviewerEmail,
		Subject:    approvalSubject,
		HtmlBody:   html,
		Tag:        "reviewer-notification,postmark",
		Metadata:   metadata,
		TrackOpens: true,
		TrackLinks: "HtmlAndText",
	}

	// Send the reviewer notification email
	activity.RecordHeartbeat(ctx, "Sending reviewer notification email via Postmark")
	result, sendErr := pea.sendEmailViaPostmark(emailRequest)
	if sendErr != nil {
		logger.Error("Failed to send reviewer notification email via Postmark", "error", sendErr)
		return &PostmarkSendEmailResult{EmailID: emailData.EmailID, Status: "reviewer_notification_failed", SentAt: time.Now(), Error: sendErr.Error()}, sendErr
	}

	if result.ErrorCode != 0 {
		err := fmt.Errorf("postmark API error: %s (code: %d)", result.Message, result.ErrorCode)
		logger.Error("Postmark API returned error for reviewer notification", "error", err)
		return &PostmarkSendEmailResult{EmailID: emailData.EmailID, Status: "reviewer_notification_failed", SentAt: time.Now(), Error: err.Error()}, err
	}

	logger.Info("Reviewer notification email sent successfully via Postmark",
		"postmark_id", result.MessageID,
		"reviewer", reviewerEmail,
		"approval_url", approveURL)

	return &PostmarkSendEmailResult{
		EmailID:    emailData.EmailID,
		PostmarkID: result.MessageID,
		Status:     "reviewer_notification_sent",
		SentAt:     result.SubmittedAt,
	}, nil
}

func (pea *PostmarkEmailActivity) sendEmailViaPostmark(emailRequest PostmarkEmailRequest) (*PostmarkEmailResponse, error) {
	jsonData, err := json.Marshal(emailRequest)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal email request: %w", err)
	}

	req, err := http.NewRequest("POST", "https://api.postmarkapp.com/email", bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, fmt.Errorf("failed to create HTTP request: %w", err)
	}

	req.Header.Set("Accept", "application/json")
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Postmark-Server-Token", pea.apiKey)

	resp, err := pea.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to send HTTP request: %w", err)
	}
	defer resp.Body.Close()

	var result PostmarkEmailResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &result, nil
}

func (pea *PostmarkEmailActivity) formatEmailContent(content, templateType string) string {
	// Basic HTML formatting based on template type
	switch templateType {
	case "marketing":
		return fmt.Sprintf(`
			<html>
			<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
				<div style="background: linear-gradient(135deg, #e83e8c 0%%, #fd7e14 100%%); padding: 20px; text-align: center;">
					<h1 style="color: white; margin: 0;">📧 Marketing Email (Postmark)</h1>
				</div>
				<div style="padding: 30px; background: #f9f9f9;">
					<div style="background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
						%s
					</div>
				</div>
				<div style="background: #333; color: white; padding: 15px; text-align: center; font-size: 12px;">
					Sent via Authentik Email Campaign System (Postmark)
				</div>
			</body>
			</html>
		`, content)
	case "transactional":
		return fmt.Sprintf(`
			<html>
			<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
				<div style="border-left: 4px solid #e83e8c; padding: 20px;">
					<h2 style="color: #333; margin-top: 0;">🔄 Transaction Notification (Postmark)</h2>
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
				<div style="background: #e83e8c; color: white; padding: 20px; text-align: center;">
					<h1 style="margin: 0;">📰 Newsletter (Postmark)</h1>
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
				<div style="background: #fd7e14; color: white; padding: 15px; border-radius: 4px;">
					<h3 style="margin: 0;">🔔 Notification (Postmark)</h3>
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
				<div style="margin-top: 20px; padding: 10px; background: #f8f9fa; border-radius: 4px; font-size: 12px; color: #666;">
					Sent via Authentik Email System (Postmark)
				</div>
			</body>
			</html>
		`, content)
	}
}
