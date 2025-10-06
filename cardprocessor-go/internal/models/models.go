package models

import (
	"database/sql/driver"
	"encoding/json"
	"time"
)

// EmailContact represents a contact in the email_contacts table
type EmailContact struct {
	ID                         string     `json:"id" db:"id"`
	TenantID                   string     `json:"tenantId" db:"tenant_id"`
	Email                      string     `json:"email" db:"email"`
	FirstName                  *string    `json:"firstName" db:"first_name"`
	LastName                   *string    `json:"lastName" db:"last_name"`
	Status                     string     `json:"status" db:"status"`
	AddedDate                  time.Time  `json:"addedDate" db:"added_date"`
	LastActivity               *time.Time `json:"lastActivity" db:"last_activity"`
	EmailsSent                 int        `json:"emailsSent" db:"emails_sent"`
	EmailsOpened               int        `json:"emailsOpened" db:"emails_opened"`
	Birthday                   *string    `json:"birthday" db:"birthday"`
	BirthdayEmailEnabled       bool       `json:"birthdayEmailEnabled" db:"birthday_email_enabled"`
	BirthdayUnsubscribeReason  *string    `json:"birthdayUnsubscribeReason" db:"birthday_unsubscribe_reason"`
	BirthdayUnsubscribedAt     *time.Time `json:"birthdayUnsubscribedAt" db:"birthday_unsubscribed_at"`
	ConsentGiven               bool       `json:"consentGiven" db:"consent_given"`
	ConsentDate                *time.Time `json:"consentDate" db:"consent_date"`
	ConsentMethod              *string    `json:"consentMethod" db:"consent_method"`
	ConsentIPAddress           *string    `json:"consentIpAddress" db:"consent_ip_address"`
	ConsentUserAgent           *string    `json:"consentUserAgent" db:"consent_user_agent"`
	AddedByUserID              *string    `json:"addedByUserId" db:"added_by_user_id"`
	CreatedAt                  time.Time  `json:"createdAt" db:"created_at"`
	UpdatedAt                  time.Time  `json:"updatedAt" db:"updated_at"`
}

// BirthdaySettings represents the birthday_settings table
type BirthdaySettings struct {
	ID              string    `json:"id" db:"id"`
	TenantID        string    `json:"tenantId" db:"tenant_id"`
	Enabled         bool      `json:"enabled" db:"enabled"`
	EmailTemplate   string    `json:"emailTemplate" db:"email_template"`
	SegmentFilter   string    `json:"segmentFilter" db:"segment_filter"`
	CustomMessage   string    `json:"customMessage" db:"custom_message"`
	CustomThemeData *string   `json:"customThemeData" db:"custom_theme_data"`
	SenderName      string    `json:"senderName" db:"sender_name"`
	PromotionID     *string   `json:"promotionId" db:"promotion_id"`
	SplitPromotionalEmail bool      `json:"splitPromotionalEmail" db:"split_promotional_email"`
	CreatedAt       time.Time `json:"createdAt" db:"created_at"`
	UpdatedAt       time.Time `json:"updatedAt" db:"updated_at"`
}

// EmailActivity represents the email_activity table
type EmailActivity struct {
	ID           string    `json:"id" db:"id"`
	TenantID     string    `json:"tenantId" db:"tenant_id"`
	ContactID    string    `json:"contactId" db:"contact_id"`
	CampaignID   *string   `json:"campaignId" db:"campaign_id"`
	NewsletterID *string   `json:"newsletterId" db:"newsletter_id"`
	ActivityType string    `json:"activityType" db:"activity_type"`
	ActivityData *string   `json:"activityData" db:"activity_data"`
	UserAgent    *string   `json:"userAgent" db:"user_agent"`
	IPAddress    *string   `json:"ipAddress" db:"ip_address"`
	WebhookID    *string   `json:"webhookId" db:"webhook_id"`
	WebhookData  *string   `json:"webhookData" db:"webhook_data"`
	OccurredAt   time.Time `json:"occurredAt" db:"occurred_at"`
	CreatedAt    time.Time `json:"createdAt" db:"created_at"`
}

// Tenant represents the tenants table (minimal for our needs)
type Tenant struct {
	ID        string    `json:"id" db:"id"`
	Name      string    `json:"name" db:"name"`
	CreatedAt time.Time `json:"createdAt" db:"created_at"`
	UpdatedAt time.Time `json:"updatedAt" db:"updated_at"`
}

// CustomThemeData represents the JSON structure for custom theme data
type CustomThemeData struct {
	PrimaryColor   string `json:"primaryColor,omitempty"`
	SecondaryColor string `json:"secondaryColor,omitempty"`
	FontFamily     string `json:"fontFamily,omitempty"`
	BackgroundURL  string `json:"backgroundUrl,omitempty"`
	LogoURL        string `json:"logoUrl,omitempty"`
}

// Value implements the driver.Valuer interface for CustomThemeData
func (c CustomThemeData) Value() (driver.Value, error) {
	return json.Marshal(c)
}

// Scan implements the sql.Scanner interface for CustomThemeData
func (c *CustomThemeData) Scan(value interface{}) error {
	if value == nil {
		return nil
	}

	bytes, ok := value.([]byte)
	if !ok {
		return nil
	}

	return json.Unmarshal(bytes, c)
}

// BirthdayJob represents a birthday email job
type BirthdayJob struct {
	ID        string     `json:"id"`
	TenantID  string     `json:"tenantId"`
	ContactID string     `json:"contactId"`
	Status    string     `json:"status"` // pending, processing, sent, failed
	CreatedAt time.Time  `json:"createdAt"`
	SentAt    *time.Time `json:"sentAt,omitempty"`
	Error     *string    `json:"error,omitempty"`
}

// BirthdayJobProgress represents the progress of birthday job processing
type BirthdayJobProgress struct {
	TenantID       string     `json:"tenantId"`
	TotalContacts  int        `json:"totalContacts"`
	ProcessedCount int        `json:"processedCount"`
	SentCount      int        `json:"sentCount"`
	FailedCount    int        `json:"failedCount"`
	StartedAt      time.Time  `json:"startedAt"`
	CompletedAt    *time.Time `json:"completedAt,omitempty"`
}

// CreateBirthdaySettingsRequest represents the request to create birthday settings
type CreateBirthdaySettingsRequest struct {
	Enabled         bool    `json:"enabled"`
	EmailTemplate   string  `json:"emailTemplate"`
	SegmentFilter   string  `json:"segmentFilter"`
	CustomMessage   string  `json:"customMessage"`
	CustomThemeData *string `json:"customThemeData"`
	SenderName      string  `json:"senderName"`
	PromotionID     *string `json:"promotionId"`
}

// UpdateBirthdaySettingsRequest represents the request to update birthday settings
type UpdateBirthdaySettingsRequest struct {
	Enabled         *bool   `json:"enabled,omitempty"`
	EmailTemplate   *string `json:"emailTemplate,omitempty"`
	SegmentFilter   *string `json:"segmentFilter,omitempty"`
	CustomMessage   *string `json:"customMessage,omitempty"`
	CustomThemeData *string `json:"customThemeData,omitempty"`
	SenderName      *string `json:"senderName,omitempty"`
	PromotionID     *string `json:"promotionId,omitempty"`
	SplitPromotionalEmail *bool   `json:"splitPromotionalEmail,omitempty"`
}

// UpdateContactBirthdayRequest represents the request to update contact birthday info
type UpdateContactBirthdayRequest struct {
	Birthday             *string `json:"birthday,omitempty"`
	BirthdayEmailEnabled *bool   `json:"birthdayEmailEnabled,omitempty"`
}

// SendTestBirthdayRequest represents the request to send a test birthday email
type SendTestBirthdayRequest struct {
	Email         string  `json:"email"`
	FirstName     *string `json:"firstName,omitempty"`
	CustomMessage *string `json:"customMessage,omitempty"`
}

// BirthdayInvitationRequest represents the request to send birthday invitation
type BirthdayInvitationRequest struct {
	Email     string `json:"email"`
	FirstName string `json:"firstName"`
	LastName  string `json:"lastName"`
}

// APIResponse represents a standard API response
type APIResponse struct {
	Success bool        `json:"success"`
	Message string      `json:"message,omitempty"`
	Data    interface{} `json:"data,omitempty"`
	Error   *string     `json:"error,omitempty"`
}

// ErrorResponse represents an error response
type ErrorResponse struct {
	Success bool   `json:"success"`
	Error   string `json:"error"`
	Code    int    `json:"code,omitempty"`
}

// BirthdayContactsResponse represents the response for birthday contacts
type BirthdayContactsResponse struct {
	Contacts   []EmailContact `json:"contacts"`
	Pagination PaginationInfo `json:"pagination"`
}

// PaginationInfo represents pagination information
type PaginationInfo struct {
	Page  int   `json:"page"`
	Limit int   `json:"limit"`
	Total int64 `json:"total"`
	Pages int64 `json:"pages"`
}

// BulkUpdateBirthdayEmailRequest represents bulk update request
type BulkUpdateBirthdayEmailRequest struct {
	ContactIDs           []string `json:"contactIds"`
	BirthdayEmailEnabled bool     `json:"birthdayEmailEnabled"`
}

// SendBirthdayInvitationRequest represents birthday invitation request
type SendBirthdayInvitationRequest struct {
	Email     string `json:"email"`
	FirstName string `json:"firstName"`
	LastName  string `json:"lastName"`
}

// Promotion represents a promotion in the promotions table
type Promotion struct {
	ID             string     `json:"id" db:"id"`
	TenantID       string     `json:"tenantId" db:"tenant_id"`
	UserID         string     `json:"userId" db:"user_id"`
	Title          string     `json:"title" db:"title"`
	Description    *string    `json:"description" db:"description"`
	Content        string     `json:"content" db:"content"`
	Type           string     `json:"type" db:"type"`
	TargetAudience string     `json:"targetAudience" db:"target_audience"`
	IsActive       bool       `json:"isActive" db:"is_active"`
	UsageCount     int        `json:"usageCount" db:"usage_count"`
	MaxUses        *int       `json:"maxUses" db:"max_uses"`
	ValidFrom      *time.Time `json:"validFrom" db:"valid_from"`
	ValidTo        *time.Time `json:"validTo" db:"valid_to"`
	CreatedAt      time.Time  `json:"createdAt" db:"created_at"`
	UpdatedAt      time.Time  `json:"updatedAt" db:"updated_at"`
}

// BirthdayUnsubscribeToken represents an unsubscribe token for birthday emails
type BirthdayUnsubscribeToken struct {
	ID        string     `json:"id" db:"id"`
	TenantID  string     `json:"tenantId" db:"tenant_id"`
	ContactID string     `json:"contactId" db:"contact_id"`
	Token     string     `json:"token" db:"token"`
	Used      bool       `json:"used" db:"used"`
	CreatedAt time.Time  `json:"createdAt" db:"created_at"`
	UsedAt    *time.Time `json:"usedAt" db:"used_at"`
}

// BirthdayUnsubscribeRequest represents the request to unsubscribe from birthday emails
type BirthdayUnsubscribeRequest struct {
	Token  string  `json:"token" form:"token"`
	Reason *string `json:"reason,omitempty" form:"reason"`
}

// BirthdayUnsubscribeResponse represents the response after unsubscribing
type BirthdayUnsubscribeResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
	Email   string `json:"email,omitempty"`
}

// SendTestBirthdayCardRequest represents test birthday card request
type SendTestBirthdayCardRequest struct {
	UserEmail       string      `json:"userEmail"`
	UserFirstName   string      `json:"userFirstName"`
	UserLastName    string      `json:"userLastName"`
	EmailTemplate   string      `json:"emailTemplate"`
	CustomMessage   string      `json:"customMessage"`
	CustomThemeData interface{} `json:"customThemeData"`
	SenderName      string      `json:"senderName"`
}

// OutgoingEmail represents an outgoing email record in the outgoing_emails table
type OutgoingEmail struct {
	ID                 string     `json:"id" db:"id"`
	TenantID           string     `json:"tenantId" db:"tenant_id"`
	RecipientEmail     string     `json:"recipientEmail" db:"recipient_email"`
	RecipientName      *string    `json:"recipientName" db:"recipient_name"`
	SenderEmail        string     `json:"senderEmail" db:"sender_email"`
	SenderName         *string    `json:"senderName" db:"sender_name"`
	Subject            string     `json:"subject" db:"subject"`
	EmailType          string     `json:"emailType" db:"email_type"`
	Provider           string     `json:"provider" db:"provider"`
	ProviderMessageID  *string    `json:"providerMessageId" db:"provider_message_id"`
	ProviderResponse   *string    `json:"providerResponse" db:"provider_response"`
	Status             string     `json:"status" db:"status"`
	SendAttempts       int        `json:"sendAttempts" db:"send_attempts"`
	ErrorMessage       *string    `json:"errorMessage" db:"error_message"`
	ContactID          *string    `json:"contactId" db:"contact_id"`
	NewsletterID       *string    `json:"newsletterId" db:"newsletter_id"`
	CampaignID         *string    `json:"campaignId" db:"campaign_id"`
	PromotionID        *string    `json:"promotionId" db:"promotion_id"`
	Metadata           *string    `json:"metadata" db:"metadata"`
	SentAt             time.Time  `json:"sentAt" db:"sent_at"`
	DeliveredAt        *time.Time `json:"deliveredAt" db:"delivered_at"`
	HTMLContent        *string    `json:"htmlContent" db:"html_content"`
	TextContent        *string    `json:"textContent" db:"text_content"`
	CreatedAt          time.Time  `json:"createdAt" db:"created_at"`
	UpdatedAt          time.Time  `json:"updatedAt" db:"updated_at"`
}

// CreateOutgoingEmailRequest represents the request to create an outgoing email record
type CreateOutgoingEmailRequest struct {
	TenantID          string  `json:"tenantId"`
	RecipientEmail    string  `json:"recipientEmail"`
	RecipientName     *string `json:"recipientName,omitempty"`
	SenderEmail       string  `json:"senderEmail"`
	SenderName        *string `json:"senderName,omitempty"`
	Subject           string  `json:"subject"`
	EmailType         string  `json:"emailType"`
	Provider          string  `json:"provider"`
	ProviderMessageID *string `json:"providerMessageId,omitempty"`
	ProviderResponse  *string `json:"providerResponse,omitempty"`
	Status            string  `json:"status"`
	SendAttempts      int     `json:"sendAttempts"`
	ErrorMessage      *string `json:"errorMessage,omitempty"`
	ContactID         *string `json:"contactId,omitempty"`
	NewsletterID      *string `json:"newsletterId,omitempty"`
	CampaignID        *string `json:"campaignId,omitempty"`
	PromotionID       *string `json:"promotionId,omitempty"`
	HTMLContent       *string `json:"htmlContent,omitempty"`
	TextContent       *string `json:"textContent,omitempty"`
	Metadata          *string `json:"metadata,omitempty"`
}

// Update OutgoingEmail struct to include content fields
// Note: The struct above already exists, but we need to note these fields were added
// In practice, you should add these fields to the existing OutgoingEmail struct:
//
// HTMLContent        *string    `json:"htmlContent" db:"html_content"`
// TextContent        *string    `json:"textContent" db:"text_content"`
