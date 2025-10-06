package handlers

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"log"
	"net/http"
	"strings"
	"time"

	"cardprocessor-go/internal/config"
	"cardprocessor-go/internal/models"
	"cardprocessor-go/internal/repository"

	"github.com/gin-gonic/gin"
)

// WebhookHandler handles provider webhooks (Resend)
type WebhookHandler struct {
	repo   *repository.Repository
	config *config.Config
}

func NewWebhookHandler(repo *repository.Repository, cfg *config.Config) *WebhookHandler {
	return &WebhookHandler{repo: repo, config: cfg}
}

// Health endpoint for webhook server
func (h *WebhookHandler) Health(c *gin.Context) {
	// Debug log for health checks in development
	if h.config.Server.Environment == "development" || strings.ToLower(h.config.GinMode) == "debug" {
		log.Printf("[webhook][health] %s %s ip=%s", c.Request.Method, c.FullPath(), c.ClientIP())
	}
	c.JSON(http.StatusOK, gin.H{"status": "ok", "service": "webhooks"})
}

// ResendWebhook processes Resend webhook events
func (h *WebhookHandler) ResendWebhook(c *gin.Context) {
	// Read body for logging and verification
	var bodyBytes []byte
	if c.Request.Body != nil {
		bodyBytes, _ = c.GetRawData()
	}
	// Debug log with incoming body (truncated)
	if h.config.Server.Environment == "development" || strings.ToLower(h.config.GinMode) == "debug" {
		sig := c.GetHeader("resend-signature")
		logBody := bodyBytes
		if len(logBody) > 8192 {
			logBody = logBody[:8192]
		}
		log.Printf("[webhook][resend] incoming %s %s ip=%s signature_present=%t tenant_header=%q body=%s", c.Request.Method, c.FullPath(), c.ClientIP(), sig != "", c.GetHeader("X-Tenant-ID"), string(logBody))
	}
	// Restore body for downstream handlers
	c.Request.Body = ioNopCloser(bodyBytes)
	// Optionally verify signature if configured
	signature := c.GetHeader("resend-signature")
	if h.config.ResendWebhookSecret != "" && signature != "" {
		// Compute HMAC
		expected := computeHMACSHA256(bodyBytes, []byte(h.config.ResendWebhookSecret))
		if !hmac.Equal([]byte(signature), []byte(expected)) {
		if h.config.Server.Environment == "development" || strings.ToLower(h.config.GinMode) == "debug" {
			log.Printf("[webhook][resend] signature mismatch ip=%s", c.ClientIP())
		}
			c.JSON(http.StatusUnauthorized, gin.H{"success": false, "error": "invalid signature"})
			return
		}
		// Put body back for parsing
		c.Request.Body = ioNopCloser(bodyBytes)
	}

	// Parse JSON into a generic map
	var payload map[string]interface{}
	if err := c.ShouldBindJSON(&payload); err != nil {
		if h.config.Server.Environment == "development" || strings.ToLower(h.config.GinMode) == "debug" {
			log.Printf("[webhook][resend] invalid JSON: %v", err)
		}
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "invalid JSON"})
		return
	}

	eventType, _ := payload["type"].(string)
	data, _ := payload["data"].(map[string]interface{})
	if eventType == "" || data == nil {
		if h.config.Server.Environment == "development" || strings.ToLower(h.config.GinMode) == "debug" {
			log.Printf("[webhook][resend] missing event type or data: eventType=%q hasData=%t", eventType, data != nil)
		}
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "missing event type or data"})
		return
	}

	recipient := extractRecipientEmail(data)
	if recipient == "" {
		if h.config.Server.Environment == "development" || strings.ToLower(h.config.GinMode) == "debug" {
			log.Printf("[webhook][resend] no recipient found in payload for event=%s", eventType)
		}
		c.JSON(http.StatusOK, gin.H{"received": true, "note": "no recipient found"})
		return
	}

	// Find contact by email (across all tenants)
	contact, err := h.repo.GetContactByEmailOnly(recipient)
	if err != nil {
		if h.config.Server.Environment == "development" || strings.ToLower(h.config.GinMode) == "debug" {
			log.Printf("[webhook][resend] contact lookup error recipient=%s: %v", recipient, err)
		}
		c.JSON(http.StatusOK, gin.H{"received": true, "note": "contact lookup error"})
		return
	}
	if contact == nil {
		if h.config.Server.Environment == "development" || strings.ToLower(h.config.GinMode) == "debug" {
			log.Printf("[webhook][resend] contact not found for recipient=%s", recipient)
		}
		c.JSON(http.StatusOK, gin.H{"received": true, "note": "contact not found"})
		return
	}
	
	// Log the tenant ID from the contact record
	if h.config.Server.Environment == "development" || strings.ToLower(h.config.GinMode) == "debug" {
		log.Printf("[webhook][resend] found contact: email=%s tenant=%s contact_id=%s", 
			contact.Email, contact.TenantID, contact.ID)
	}

	// Update metrics based on event
	activityType := mapResendEventToActivity(eventType)
	_ = h.repo.UpdateContactMetrics(c.Request.Context(), contact.ID, activityType)

	// Prepare activity payload with a category flag so UI can identify birthday emails
	wrapped := map[string]interface{}{
		"category": "birthday",
		"provider": "resend",
		"raw":      data,
	}
	activityDataBytes, _ := json.Marshal(wrapped)
	activityDataStr := string(activityDataBytes)

	// Extract additional fields from webhook data
	// Check nested structures first (open, click, bounce, etc.)
	userAgent := ""
	ipAddress := ""
	if openData, ok := data["open"].(map[string]interface{}); ok {
		userAgent = getString(openData, "userAgent", "user_agent")
		ipAddress = getString(openData, "ipAddress", "ip_address")
	} else if clickData, ok := data["click"].(map[string]interface{}); ok {
		userAgent = getString(clickData, "userAgent", "user_agent")
		ipAddress = getString(clickData, "ipAddress", "ip_address")
	} else if bounceData, ok := data["bounce"].(map[string]interface{}); ok {
		userAgent = getString(bounceData, "userAgent", "user_agent")
		ipAddress = getString(bounceData, "ipAddress", "ip_address")
	}
	// Fallback to top-level fields
	if userAgent == "" {
		userAgent = getString(data, "user_agent", "UserAgent")
	}
	if ipAddress == "" {
		ipAddress = getString(data, "ip_address", "IPAddress")
	}
	webhookID := getString(data, "email_id", "id", "MessageID")

	var newsletterID *string
	var campaignID *string
	if v := deepGetString(data, "metadata.newsletterId"); v != "" {
		newsletterID = &v
	}
	if v := deepGetString(data, "newsletterId"); v != "" && newsletterID == nil {
		newsletterID = &v
	}
	if v := deepGetString(data, "metadata.campaignId"); v != "" {
		campaignID = &v
	}
	if v := deepGetString(data, "campaignId"); v != "" && campaignID == nil {
		campaignID = &v
	}

	// Create email activity record
	if h.config.Server.Environment == "development" || strings.ToLower(h.config.GinMode) == "debug" {
		log.Printf("[webhook][resend] preparing to save: type=%s tenant=%s contact=%s email=%s ip=%s ua_len=%d",
			activityType, contact.TenantID, contact.ID, contact.Email, ipAddress, len(userAgent))
	}
	activity := &models.EmailActivity{
		TenantID:     contact.TenantID,
		ContactID:    contact.ID,
		CampaignID:   campaignID,
		NewsletterID: newsletterID,
		ActivityType: activityType,
		ActivityData: &activityDataStr,
		UserAgent:    stringPtrOrNil(userAgent),
		IPAddress:    stringPtrOrNil(ipAddress),
		WebhookID:    stringPtrOrNil(webhookID),
		WebhookData:  stringPtrOrNil(string(mustJSON(data))),
		OccurredAt:   time.Now(),
	}
	if err := h.repo.CreateEmailActivity(activity); err != nil {
		log.Printf("[webhook][resend] failed to create email activity: %v", err)
		if h.config.Server.Environment == "development" || strings.ToLower(h.config.GinMode) == "debug" {
			log.Printf("[webhook][resend] activity details: tenant=%s contact=%s type=%s webhook_id=%s",
				activity.TenantID, activity.ContactID, activity.ActivityType, 
				func() string { if activity.WebhookID != nil { return *activity.WebhookID } else { return "nil" } }())
		}
		c.JSON(http.StatusOK, gin.H{"received": true, "note": "failed to save activity"})
		return
	}
	
	// Success logging
	if h.config.Server.Environment == "development" || strings.ToLower(h.config.GinMode) == "debug" {
		log.Printf("[webhook][resend] ✅ saved activity: type=%s tenant=%s contact=%s recipient=%s", 
			activityType, contact.TenantID, contact.ID, recipient)
	}

	c.JSON(http.StatusOK, gin.H{"received": true})
}

func computeHMACSHA256(message, secret []byte) string {
	h := hmac.New(sha256.New, secret)
	h.Write(message)
	return hex.EncodeToString(h.Sum(nil))
}

// helper to rewrap body back into ReadCloser
type rc struct{ *strings.Reader }
func ioNopCloser(b []byte) *rc { return &rc{strings.NewReader(string(b))} }
func (r *rc) Close() error { return nil }

func extractRecipientEmail(data map[string]interface{}) string {
	// Resend may send to: ["user@example.com"] or [{email: "..."}] or string
	if v, ok := data["to"]; ok {
		switch t := v.(type) {
		case []interface{}:
			if len(t) > 0 {
				switch rec := t[0].(type) {
				case string:
					return rec
				case map[string]interface{}:
					if e, ok := rec["email"].(string); ok {
						return e
					}
				}
			}
		case string:
			return t
		}
	}
	if e, ok := data["email"].(string); ok {
		return e
	}
	if e, ok := data["Email"].(string); ok {
		return e
	}
	return ""
}

func mapResendEventToActivity(eventType string) string {
	switch eventType {
	case "email.sent":
		return "sent"
	case "email.delivered":
		return "delivered"
	case "email.opened":
		return "opened"
	case "email.clicked":
		return "clicked"
	case "email.bounced":
		return "bounced"
	case "email.complained":
		return "complained"
	case "email.delivery_delayed":
		return "delivery_delayed"
	case "email.failed":
		return "failed"
	case "email.scheduled":
		return "scheduled"
	default:
		return strings.ToLower(eventType)
	}
}

func getString(m map[string]interface{}, keys ...string) string {
	for _, k := range keys {
		if v, ok := m[k].(string); ok {
			return v
		}
	}
	return ""
}

func deepGetString(m map[string]interface{}, path string) string {
	parts := strings.Split(path, ".")
	var cur interface{} = m
	for _, p := range parts {
		mm, ok := cur.(map[string]interface{})
		if !ok {
			return ""
		}
		cur, ok = mm[p]
		if !ok {
			return ""
		}
	}
	if s, ok := cur.(string); ok {
		return s
	}
	return ""
}

func mustJSON(v interface{}) []byte {
	b, _ := json.Marshal(v)
	return b
}

func stringPtrOrNil(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}
