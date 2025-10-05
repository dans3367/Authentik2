package handlers

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"time"

	"cardprocessor-go/internal/config"
	"cardprocessor-go/internal/middleware"
	"cardprocessor-go/internal/models"
	"cardprocessor-go/internal/repository"
	"cardprocessor-go/internal/temporal"
	"cardprocessor-go/internal/i18n"

	"github.com/gin-gonic/gin"
)

// BirthdayHandler handles birthday-related API endpoints
type BirthdayHandler struct {
	repo           *repository.Repository
	temporalClient *temporal.TemporalClient
	config         *config.Config
}

// NewBirthdayHandler creates a new birthday handler
func NewBirthdayHandler(repo *repository.Repository, temporalClient *temporal.TemporalClient, cfg *config.Config) *BirthdayHandler {
	return &BirthdayHandler{
		repo:           repo,
		temporalClient: temporalClient,
		config:         cfg,
	}
}

// GetBirthdaySettings retrieves birthday settings for a tenant
func (h *BirthdayHandler) GetBirthdaySettings(c *gin.Context) {
	tenantID, err := middleware.GetTenantID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":   "Tenant ID not found",
		})
		return
	}

	settings, err := h.repo.GetBirthdaySettings(c.Request.Context(), tenantID)
	if err != nil {
		// Return default settings if none exist
		defaultSettings := &models.BirthdaySettings{
			ID:            "",
			TenantID:      tenantID,
			Enabled:       false,
			EmailTemplate: "default",
			SegmentFilter: "all",
			CustomMessage: "",
			SenderName:    "",
			PromotionID:   nil,
			CreatedAt:     time.Now(),
			UpdatedAt:     time.Now(),
		}
		c.JSON(http.StatusOK, defaultSettings)
		return
	}

	c.JSON(http.StatusOK, settings)
}

// UpdateBirthdaySettings updates birthday settings for a tenant
func (h *BirthdayHandler) UpdateBirthdaySettings(c *gin.Context) {
	tenantID, err := middleware.GetTenantID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":   "Tenant ID not found",
		})
		return
	}

	var req models.UpdateBirthdaySettingsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid request body",
		})
		return
	}

	// Validate required fields
	if req.EmailTemplate == nil || *req.EmailTemplate == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "emailTemplate is required",
		})
		return
	}

	if req.SegmentFilter == nil || *req.SegmentFilter == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "segmentFilter is required",
		})
		return
	}

	if req.SenderName == nil || *req.SenderName == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "senderName is required and must be a string",
		})
		return
	}

	// Validate custom theme data if provided
	if req.CustomThemeData != nil && *req.CustomThemeData != "" {
		var themeData map[string]interface{}
		if err := json.Unmarshal([]byte(*req.CustomThemeData), &themeData); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"success": false,
				"error":   "Invalid custom theme data JSON",
			})
			return
		}
	}

	settings := &models.BirthdaySettings{
		TenantID:        tenantID,
		Enabled:         *req.Enabled,
		EmailTemplate:   *req.EmailTemplate,
		SegmentFilter:   *req.SegmentFilter,
		CustomMessage:   getStringValue(req.CustomMessage),
		CustomThemeData: req.CustomThemeData,
		SenderName:      getStringValue(req.SenderName),
		PromotionID:     req.PromotionID,
		SplitPromotionalEmail: getBoolValue(req.SplitPromotionalEmail),
		UpdatedAt:       time.Now(),
	}

	updatedSettings, err := h.repo.UpdateBirthdaySettings(c.Request.Context(), settings)
	if err != nil {
		fmt.Printf("❌ [500 ERROR] UpdateBirthdaySettings failed\n")
		fmt.Printf("   └─ Tenant ID: %s\n", tenantID)
		fmt.Printf("   └─ Error Type: %T\n", err)
		fmt.Printf("   └─ Error Message: %v\n", err)
		fmt.Printf("   └─ Settings: enabled=%v, template=%s, segment=%s\n",
			settings.Enabled, settings.EmailTemplate, settings.SegmentFilter)
		fmt.Printf("   └─ Request Path: %s %s\n", c.Request.Method, c.Request.URL.Path)
		fmt.Printf("   └─ Client IP: %s\n", c.ClientIP())
		fmt.Printf("   └─ Stack Trace: Failed to update birthday settings: %+v\n", err)

		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to update birthday settings",
		})
		return
	}

	c.JSON(http.StatusOK, updatedSettings)
}

// GetBirthdayContacts retrieves contacts with birthdays for a tenant
func (h *BirthdayHandler) GetBirthdayContacts(c *gin.Context) {
	tenantID, err := middleware.GetTenantID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":   "Tenant ID not found",
		})
		return
	}

	// Parse query parameters
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	upcomingOnly := c.Query("upcomingOnly") == "true"

	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 50
	}

	offset := (page - 1) * limit

	var contacts []models.EmailContact
	var total int64

	if upcomingOnly {
		// Get contacts with birthdays in the next 30 days
		contacts, total, err = h.repo.GetUpcomingBirthdayContacts(c.Request.Context(), tenantID, limit, offset)
	} else {
		// Get all contacts with birthdays
		contacts, total, err = h.repo.GetBirthdayContacts(c.Request.Context(), tenantID, limit, offset)
	}

	if err != nil {
		fmt.Printf("❌ [500 ERROR] GetBirthdayContacts failed\n")
		fmt.Printf("   └─ Tenant ID: %s\n", tenantID)
		fmt.Printf("   └─ Error Type: %T\n", err)
		fmt.Printf("   └─ Error Message: %v\n", err)
		fmt.Printf("   └─ Query Parameters: page=%d, limit=%d, upcomingOnly=%v\n", page, limit, upcomingOnly)
		fmt.Printf("   └─ Offset: %d\n", offset)
		fmt.Printf("   └─ Request Path: %s %s\n", c.Request.Method, c.Request.URL.Path)
		fmt.Printf("   └─ Client IP: %s\n", c.ClientIP())
		fmt.Printf("   └─ Stack Trace: %+v\n", err)

		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to get birthday contacts",
		})
		return
	}

	response := models.BirthdayContactsResponse{
		Contacts: contacts,
		Pagination: models.PaginationInfo{
			Page:  page,
			Limit: limit,
			Total: total,
			Pages: (total + int64(limit) - 1) / int64(limit),
		},
	}

	c.JSON(http.StatusOK, response)
}

// UpdateContactBirthday updates a contact's birthday information
func (h *BirthdayHandler) UpdateContactBirthday(c *gin.Context) {
	tenantID, err := middleware.GetTenantID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":   "Tenant ID not found",
		})
		return
	}

	contactID := c.Param("contactId")
	if contactID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Contact ID is required",
		})
		return
	}

	var req models.UpdateContactBirthdayRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid request body",
		})
		return
	}

	// Validate birthday format if provided
	if req.Birthday != nil && *req.Birthday != "" {
		if _, err := time.Parse("2006-01-02", *req.Birthday); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"success": false,
				"error":   "Invalid birthday format. Use YYYY-MM-DD",
			})
			return
		}
	}

	_, err = h.repo.UpdateContactBirthday(c.Request.Context(), tenantID, contactID, req.Birthday, req.BirthdayEmailEnabled)
	if err != nil {
		fmt.Printf("❌ [500 ERROR] UpdateContactBirthday failed\n")
		fmt.Printf("   └─ Tenant ID: %s\n", tenantID)
		fmt.Printf("   └─ Contact ID: %s\n", contactID)
		fmt.Printf("   └─ Error Type: %T\n", err)
		fmt.Printf("   └─ Error Message: %v\n", err)
		fmt.Printf("   └─ Birthday: %v\n", req.Birthday)
		fmt.Printf("   └─ Email Enabled: %v\n", req.BirthdayEmailEnabled)
		fmt.Printf("   └─ Request Path: %s %s\n", c.Request.Method, c.Request.URL.Path)
		fmt.Printf("   └─ Client IP: %s\n", c.ClientIP())
		fmt.Printf("   └─ Stack Trace: %+v\n", err)

		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to update contact birthday",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Contact birthday updated successfully",
	})
}

// UpdateBulkBirthdayEmailPreference updates birthday email preference for multiple contacts
func (h *BirthdayHandler) UpdateBulkBirthdayEmailPreference(c *gin.Context) {
	tenantID, err := middleware.GetTenantID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":   "Tenant ID not found",
		})
		return
	}

	var req models.BulkUpdateBirthdayEmailRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid request body",
		})
		return
	}

	if len(req.ContactIDs) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Contact IDs are required",
		})
		return
	}

	err = h.repo.UpdateBulkBirthdayEmailPreference(c.Request.Context(), tenantID, req.ContactIDs, req.BirthdayEmailEnabled)
	if err != nil {
		fmt.Printf("❌ [500 ERROR] UpdateBulkBirthdayEmailPreference failed\n")
		fmt.Printf("   └─ Tenant ID: %s\n", tenantID)
		fmt.Printf("   └─ Error Type: %T\n", err)
		fmt.Printf("   └─ Error Message: %v\n", err)
		fmt.Printf("   └─ Contact IDs Count: %d\n", len(req.ContactIDs))
		fmt.Printf("   └─ Contact IDs: %v\n", req.ContactIDs)
		fmt.Printf("   └─ Email Enabled: %v\n", req.BirthdayEmailEnabled)
		fmt.Printf("   └─ Request Path: %s %s\n", c.Request.Method, c.Request.URL.Path)
		fmt.Printf("   └─ Client IP: %s\n", c.ClientIP())
		fmt.Printf("   └─ Stack Trace: %+v\n", err)

		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to update birthday email preferences",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Birthday email preferences updated successfully",
	})
}

// SendBirthdayInvitation sends a birthday invitation to a contact
func (h *BirthdayHandler) SendBirthdayInvitation(c *gin.Context) {
	tenantID, err := middleware.GetTenantID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":   "Tenant ID not found",
		})
		return
	}

	_, err = middleware.GetUserID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":   "User ID not found",
		})
		return
	}

	contactID := c.Param("contactId")
	if contactID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Contact ID is required",
		})
		return
	}

	var req models.SendBirthdayInvitationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid request body",
		})
		return
	}

	// Get contact information
	contact, err := h.repo.GetContactByID(c.Request.Context(), tenantID, contactID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"error":   "Contact not found",
		})
		return
	}

	// TODO: Implement birthday invitation email sending logic
	// This would integrate with the email service providers

	// For now, return success
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Birthday invitation sent successfully",
		"contact": gin.H{
			"id":        contact.ID,
			"email":     contact.Email,
			"firstName": contact.FirstName,
			"lastName":  contact.LastName,
		},
	})
}

// SendTestBirthdayCard sends a test birthday card to a user
func (h *BirthdayHandler) SendTestBirthdayCard(c *gin.Context) {
	fmt.Printf("🎂 [Birthday Test] Request received from IP: %s\n", c.ClientIP())
	fmt.Printf("🎂 [Birthday Test] Headers: %+v\n", c.Request.Header)

	tenantID, err := middleware.GetTenantID(c)
	if err != nil {
		fmt.Printf("❌ [Birthday Test] Failed to get tenant ID: %v\n", err)
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":   "Tenant ID not found",
		})
		return
	}
	fmt.Printf("✅ [Birthday Test] Tenant ID extracted: %s\n", tenantID)

	userID, err := middleware.GetUserID(c)
	if err != nil {
		fmt.Printf("❌ [Birthday Test] Failed to get user ID: %v\n", err)
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":   "User ID not found",
		})
		return
	}
	fmt.Printf("✅ [Birthday Test] User ID extracted: %s\n", userID)

	// Log raw request body
	bodyBytes, _ := c.GetRawData()
	fmt.Printf("🎂 [Birthday Test] Raw request body: %s\n", string(bodyBytes))

	// Reset the request body for ShouldBindJSON
	c.Request.Body = io.NopCloser(bytes.NewBuffer(bodyBytes))

	var req models.SendTestBirthdayCardRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		fmt.Printf("❌ [Birthday Test] Failed to bind JSON: %v\n", err)
		fmt.Printf("❌ [Birthday Test] Request body that failed to bind: %s\n", string(bodyBytes))
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid request body",
		})
		return
	}

	fmt.Printf("✅ [Birthday Test] Request parsed successfully: %+v\n", req)

	// Validate required fields
	if req.UserEmail == "" {
		fmt.Printf("❌ [Birthday Test] User email is empty\n")
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "User email is required",
		})
		return
	}
	fmt.Printf("✅ [Birthday Test] User email validation passed: %s\n", req.UserEmail)

	// Convert CustomThemeData to proper format
	var customThemeData map[string]interface{}
	if req.CustomThemeData != nil {
		switch v := req.CustomThemeData.(type) {
		case map[string]interface{}:
			customThemeData = v
		case string:
			if v == "null" || v == "" {
				customThemeData = nil
			} else {
				// Try to parse as JSON
				var parsed map[string]interface{}
				if err := json.Unmarshal([]byte(v), &parsed); err != nil {
					fmt.Printf("⚠️ [Birthday Test] Failed to parse CustomThemeData as JSON: %v\n", err)
					customThemeData = nil
				} else {
					customThemeData = parsed
				}
			}
		default:
			fmt.Printf("⚠️ [Birthday Test] Unexpected CustomThemeData type: %T\n", v)
			customThemeData = nil
		}
	}
	fmt.Printf("🎂 [Birthday Test] CustomThemeData converted: %+v\n", customThemeData)

	// Get tenant name for the workflow
	tenantName := "Your Company" // Default fallback
	// TODO: Get actual tenant name from database if needed

	fmt.Printf("🎂 [Birthday Test] Checking Temporal client availability...\n")
	fmt.Printf("🎂 [Birthday Test] Temporal client: %v\n", h.temporalClient != nil)
	if h.temporalClient != nil {
		fmt.Printf("🎂 [Birthday Test] Temporal client connected: %v\n", h.temporalClient.IsConnected())
	}

	// Fetch birthday settings to get promotion ID
	var promotionID string
	birthdaySettings, err := h.repo.GetBirthdaySettings(context.Background(), tenantID)
	if err != nil {
		fmt.Printf("⚠️ [Birthday Test] Failed to fetch birthday settings: %v\n", err)
	} else if birthdaySettings != nil {
		if birthdaySettings.PromotionID != nil {
			promotionID = *birthdaySettings.PromotionID
			fmt.Printf("🎁 [Birthday Test] Found promotion ID in settings: %s\n", promotionID)
		}
		fmt.Printf("📧 [Birthday Test] Split Promotional Email setting: %v\n", birthdaySettings.SplitPromotionalEmail)
	}

	// If temporal client is available, use workflow; otherwise, send directly
	if h.temporalClient != nil && h.temporalClient.IsConnected() {
		fmt.Printf("🎂 [Birthday Test] Using Temporal workflow\n")

		// Prepare workflow input
		workflowInput := temporal.BirthdayTestWorkflowInput{
			UserID:          userID,
			UserEmail:       req.UserEmail,
			UserFirstName:   req.UserFirstName,
			UserLastName:    req.UserLastName,
			TenantID:        tenantID,
			TenantName:      tenantName,
			FromEmail:       h.config.DefaultFromEmail,
			EmailTemplate:   req.EmailTemplate,
			CustomMessage:   req.CustomMessage,
			CustomThemeData: customThemeData,
			SenderName:      req.SenderName,
			PromotionID:     promotionID,
			SplitPromotionalEmail: birthdaySettings != nil && birthdaySettings.SplitPromotionalEmail,
			IsTest:          true,
		}

		fmt.Printf("🎂 [Birthday Test] Workflow input prepared: %+v\n", workflowInput)

		// Start the birthday test workflow
		ctx := context.Background()
		workflowRun, err := h.temporalClient.StartBirthdayTestWorkflow(ctx, workflowInput)
		if err != nil {
			fmt.Printf("❌ [500 ERROR] StartBirthdayTestWorkflow failed\n")
			fmt.Printf("   └─ Tenant ID: %s\n", tenantID)
			fmt.Printf("   └─ User ID: %s\n", userID)
			fmt.Printf("   └─ User Email: %s\n", req.UserEmail)
			fmt.Printf("   └─ Error Type: %T\n", err)
			fmt.Printf("   └─ Error Message: %v\n", err)
			fmt.Printf("   └─ Email Template: %s\n", req.EmailTemplate)
			fmt.Printf("   └─ Sender Name: %s\n", req.SenderName)
			fmt.Printf("   └─ Promotion ID: %s\n", promotionID)
			fmt.Printf("   └─ Temporal Connected: %v\n", h.temporalClient.IsConnected())
			fmt.Printf("   └─ Request Path: %s %s\n", c.Request.Method, c.Request.URL.Path)
			fmt.Printf("   └─ Client IP: %s\n", c.ClientIP())
			fmt.Printf("   └─ Stack Trace: %+v\n", err)

			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"error":   "Failed to start birthday test workflow: " + err.Error(),
			})
			return
		}

		fmt.Printf("✅ [Birthday Test] Workflow started successfully: %s\n", workflowRun.GetID())

		c.JSON(http.StatusOK, gin.H{
			"success":       true,
			"message":       "Birthday test workflow started successfully",
			"workflowId":    workflowRun.GetID(),
			"workflowRunId": workflowRun.GetRunID(),
			"recipient": gin.H{
				"userId":    userID,
				"userEmail": req.UserEmail,
			},
		})
		return
	}


	// Check if Temporal is unavailable
	fmt.Printf("⚠️ [Birthday Test] Temporal client not available or not connected\n")
	fmt.Printf("🔧 [Birthday Test] Fallback enabled: %v\n", h.config.EnableEmailFallback)

	// Check if fallback is enabled
	if !h.config.EnableEmailFallback {
		fmt.Printf("❌ [Birthday Test] Email fallback is DISABLED. Temporal is required but unavailable.\n")
		fmt.Printf("   └─ Temporal Client: %v\n", h.temporalClient != nil)
		if h.temporalClient != nil {
			fmt.Printf("   └─ Temporal Connected: %v\n", h.temporalClient.IsConnected())
		}
		fmt.Printf("   └─ To enable fallback for development, set ENABLE_EMAIL_FALLBACK=true in .env\n")
		fmt.Printf("   └─ WARNING: Fallback should NEVER be enabled in production!\n")
		
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"success": false,
			"error":   "Temporal workflow service is unavailable and email fallback is disabled. Please check Temporal connection or enable fallback for development (ENABLE_EMAIL_FALLBACK=true).",
			"details": gin.H{
				"temporalAvailable": h.temporalClient != nil && h.temporalClient.IsConnected(),
				"fallbackEnabled":   h.config.EnableEmailFallback,
			},
		})
		return
	}

	// Fallback is enabled - log warning
	fmt.Printf("⚠️ [Birthday Test] Using FALLBACK mode (direct email sending)\n")
	fmt.Printf("⚠️ WARNING: Fallback mode is active! This bypasses Temporal workflow.\n")
	fmt.Printf("⚠️ WARNING: This should ONLY be used in development environments!\n")
	fmt.Printf("⚠️ WARNING: Production deployments must use Temporal for reliability.\n")

	// Fallback: Send email directly (simplified implementation)
	// TODO: Implement direct email sending as fallback
	// For now, just return success with a warning
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Test birthday card queued (fallback mode - Temporal unavailable)",
		"warning": "Email sent via fallback mechanism. Temporal workflow service is unavailable.",
		"recipient": gin.H{
			"userId":    userID,
			"userEmail": req.UserEmail,
		},
		"fallbackMode": true,
	})
}


// GenerateBirthdayUnsubscribeToken generates an unsubscribe token for a contact
func (h *BirthdayHandler) GenerateBirthdayUnsubscribeToken(c *gin.Context) {
	tenantID, err := middleware.GetTenantID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":   "Tenant ID not found",
		})
		return
	}

	contactID := c.Param("contactId")
	if contactID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Contact ID is required",
		})
		return
	}

	// Verify contact exists and belongs to tenant
	contact, err := h.repo.GetContactByID(c.Request.Context(), tenantID, contactID)
	if err != nil {
		fmt.Printf("❌ [500 ERROR] GetContactByID failed (GenerateBirthdayUnsubscribeToken)\n")
		fmt.Printf("   └─ Tenant ID: %s\n", tenantID)
		fmt.Printf("   └─ Contact ID: %s\n", contactID)
		fmt.Printf("   └─ Error Type: %T\n", err)
		fmt.Printf("   └─ Error Message: %v\n", err)
		fmt.Printf("   └─ Request Path: %s %s\n", c.Request.Method, c.Request.URL.Path)
		fmt.Printf("   └─ Client IP: %s\n", c.ClientIP())
		fmt.Printf("   └─ Stack Trace: %+v\n", err)

		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to get contact",
		})
		return
	}

	if contact == nil {
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"error":   "Contact not found",
		})
		return
	}

	// Generate secure random token
	tokenBytes := make([]byte, 32)
	_, err = rand.Read(tokenBytes)
	if err != nil {
		fmt.Printf("❌ [500 ERROR] Failed to generate random token\n")
		fmt.Printf("   └─ Tenant ID: %s\n", tenantID)
		fmt.Printf("   └─ Contact ID: %s\n", contactID)
		fmt.Printf("   └─ Error Type: %T\n", err)
		fmt.Printf("   └─ Error Message: %v\n", err)
		fmt.Printf("   └─ Request Path: %s %s\n", c.Request.Method, c.Request.URL.Path)
		fmt.Printf("   └─ Client IP: %s\n", c.ClientIP())
		fmt.Printf("   └─ Stack Trace: %+v\n", err)

		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to generate token",
		})
		return
	}
	token := hex.EncodeToString(tokenBytes)

	// Create unsubscribe token in database
	unsubToken, err := h.repo.CreateBirthdayUnsubscribeToken(c.Request.Context(), tenantID, contactID, token)
	if err != nil {
		fmt.Printf("❌ [500 ERROR] CreateBirthdayUnsubscribeToken failed\n")
		fmt.Printf("   └─ Tenant ID: %s\n", tenantID)
		fmt.Printf("   └─ Contact ID: %s\n", contactID)
		fmt.Printf("   └─ Token Length: %d\n", len(token))
		fmt.Printf("   └─ Error Type: %T\n", err)
		fmt.Printf("   └─ Error Message: %v\n", err)
		fmt.Printf("   └─ Request Path: %s %s\n", c.Request.Method, c.Request.URL.Path)
		fmt.Printf("   └─ Client IP: %s\n", c.ClientIP())
		fmt.Printf("   └─ Stack Trace: %+v\n", err)

		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to create unsubscribe token",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"token":   unsubToken.Token,
		"contact": gin.H{
			"id":    contact.ID,
			"email": contact.Email,
		},
	})
}

// ShowBirthdayUnsubscribePage shows the unsubscribe page
func (h *BirthdayHandler) ShowBirthdayUnsubscribePage(c *gin.Context) {
	token := c.Query("token")
	// Detect language from query param or Accept-Language header
	lang := c.Query("lang")
	if lang == "" {
		acceptLang := c.GetHeader("Accept-Language")
		lang = i18n.DetectLanguage(acceptLang)
	}
	t := i18n.GetTranslations(lang)
	_ = t // ensure variable is used even if specific branches do not reference it
	
	if token == "" {
		c.HTML(http.StatusBadRequest, "unsubscribe_error.html", gin.H{
			"ErrorTitle":    t.ErrorTitle,
			"ErrorHeading":  t.ErrorHeading,
			"ErrorMessage":  t.TokenMissingError,
			"Lang":          lang,
			"TemplateText":  i18n.GetTemplateText(lang),
		})
		return
	}

	// Get unsubscribe token from database
	unsubToken, err := h.repo.GetBirthdayUnsubscribeToken(c.Request.Context(), token)
	if err != nil {
		fmt.Printf("❌ [500 ERROR] GetBirthdayUnsubscribeToken failed (ShowBirthdayUnsubscribePage)\n")
		fmt.Printf("   └─ Token: %s\n", token)
		fmt.Printf("   └─ Error Type: %T\n", err)
		fmt.Printf("   └─ Error Message: %v\n", err)
		fmt.Printf("   └─ Request Path: %s %s\n", c.Request.Method, c.Request.URL.Path)
		fmt.Printf("   └─ Client IP: %s\n", c.ClientIP())
		fmt.Printf("   └─ Query String: %s\n", c.Request.URL.RawQuery)
		fmt.Printf("   └─ Stack Trace: %+v\n", err)

		c.HTML(http.StatusInternalServerError, "unsubscribe_error.html", gin.H{
			"ErrorTitle":    t.ErrorTitle,
			"ErrorHeading":  t.ErrorHeading,
						"ErrorMessage": t.ProcessingError,
		})
		return
	}

	if unsubToken == nil {
		c.HTML(http.StatusNotFound, "unsubscribe_error.html", gin.H{
			"ErrorTitle":    t.ErrorTitle,
			"ErrorHeading":  t.ErrorHeading,
						"ErrorMessage": t.TokenNotFoundError,
		})
		return
	}

	if unsubToken.Used {
		// Try to load contact info for context, but don't fail if missing
		var contact *models.EmailContact
		if cinfo, err := h.repo.GetContactByID(c.Request.Context(), unsubToken.TenantID, unsubToken.ContactID); err == nil {
			contact = cinfo
		}

		c.HTML(http.StatusOK, "unsubscribe_success.html", gin.H{
						"Message":        t.AlreadyUnsubscribedMessage,
			"Contact": contact,
			"Token":   token, // ensure resubscribe button has a token
		})
		return
	}

	// Get contact information
	contact, err := h.repo.GetContactByID(c.Request.Context(), unsubToken.TenantID, unsubToken.ContactID)
	if err != nil || contact == nil {
		fmt.Printf("❌ [500 ERROR] GetContactByID failed (ShowBirthdayUnsubscribePage)\n")
		fmt.Printf("   └─ Tenant ID: %s\n", unsubToken.TenantID)
		fmt.Printf("   └─ Contact ID: %s\n", unsubToken.ContactID)
		fmt.Printf("   └─ Token: %s\n", token)
		fmt.Printf("   └─ Contact is nil: %v\n", contact == nil)
		if err != nil {
			fmt.Printf("   └─ Error Type: %T\n", err)
			fmt.Printf("   └─ Error Message: %v\n", err)
			fmt.Printf("   └─ Stack Trace: %+v\n", err)
		}
		fmt.Printf("   └─ Request Path: %s %s\n", c.Request.Method, c.Request.URL.Path)
		fmt.Printf("   └─ Client IP: %s\n", c.ClientIP())

		c.HTML(http.StatusInternalServerError, "unsubscribe_error.html", gin.H{
			"ErrorTitle":    t.ErrorTitle,
			"ErrorHeading":  t.ErrorHeading,
						"ErrorMessage": t.ContactNotFoundError,
		})
		return
	}

	// Show unsubscribe form
	c.HTML(http.StatusOK, "unsubscribe.html", gin.H{
		"Token":     token,
		"Email":     contact.Email,
		"FirstName": getStringValue(contact.FirstName),
		"LastName":  getStringValue(contact.LastName),
		"Lang":          lang,
		"Translations":  t,
	})
}

// ProcessBirthdayUnsubscribe processes the unsubscribe request
func (h *BirthdayHandler) ProcessBirthdayUnsubscribe(c *gin.Context) {
	// Detect language
	lang := c.Query("lang")
	if lang == "" {
		lang = c.PostForm("lang")
	}
	if lang == "" {
		acceptLang := c.GetHeader("Accept-Language")
		lang = i18n.DetectLanguage(acceptLang)
	}
	t := i18n.GetTranslations(lang)

	var req models.BirthdayUnsubscribeRequest
	if err := c.ShouldBind(&req); err != nil {
		c.HTML(http.StatusBadRequest, "unsubscribe_error.html", gin.H{
			"ErrorTitle":   t.ErrorTitle,
			"ErrorHeading": t.ErrorHeading,
			"ErrorMessage": t.InvalidRequestError,
			"Lang":         lang,
			"TemplateText": i18n.GetTemplateText(lang),
		})
		return
	}

	if req.Token == "" {
		c.HTML(http.StatusBadRequest, "unsubscribe_error.html", gin.H{
			"ErrorTitle":   t.ErrorTitle,
			"ErrorHeading": t.ErrorHeading,
			"ErrorMessage": t.TokenRequiredError,
			"Lang":         lang,
			"TemplateText": i18n.GetTemplateText(lang),
		})
		return
	}

	// Get unsubscribe token from database
	unsubToken, err := h.repo.GetBirthdayUnsubscribeToken(c.Request.Context(), req.Token)
	if err != nil {
		fmt.Printf("❌ [500 ERROR] GetBirthdayUnsubscribeToken failed (ProcessBirthdayUnsubscribe)\n")
		fmt.Printf("   └─ Token: %s\n", req.Token)
		fmt.Printf("   └─ Error Type: %T\n", err)
		fmt.Printf("   └─ Error Message: %v\n", err)
		fmt.Printf("   └─ Request Path: %s %s\n", c.Request.Method, c.Request.URL.Path)
		fmt.Printf("   └─ Client IP: %s\n", c.ClientIP())
		fmt.Printf("   └─ Form Data - Reason: %v\n", req.Reason)
		fmt.Printf("   └─ Stack Trace: %+v\n", err)

		c.HTML(http.StatusInternalServerError, "unsubscribe_error.html", gin.H{
			"ErrorTitle":   t.ErrorTitle,
			"ErrorHeading": t.ErrorHeading,
			"ErrorMessage": t.ProcessingError,
			"Lang":         lang,
			"TemplateText": i18n.GetTemplateText(lang),
		})
		return
	}

	if unsubToken == nil {
		c.HTML(http.StatusNotFound, "unsubscribe_error.html", gin.H{
			"ErrorTitle":   t.ErrorTitle,
			"ErrorHeading": t.ErrorHeading,
			"ErrorMessage": t.TokenNotFoundError,
			"Lang":         lang,
			"TemplateText": i18n.GetTemplateText(lang),
		})
		return
	}

	if unsubToken.Used {
		c.HTML(http.StatusBadRequest, "unsubscribe_error.html", gin.H{
			"ErrorTitle":   t.ErrorTitle,
			"ErrorHeading": t.ErrorHeading,
			"ErrorMessage": t.AlreadyUsedError,
			"Lang":         lang,
			"TemplateText": i18n.GetTemplateText(lang),
		})
		return
	}

	// Get contact information for response
	contact, err := h.repo.GetContactByID(c.Request.Context(), unsubToken.TenantID, unsubToken.ContactID)
	if err != nil || contact == nil {
		fmt.Printf("❌ [500 ERROR] GetContactByID failed (ProcessBirthdayUnsubscribe)\n")
		fmt.Printf("   └─ Tenant ID: %s\n", unsubToken.TenantID)
		fmt.Printf("   └─ Contact ID: %s\n", unsubToken.ContactID)
		fmt.Printf("   └─ Token: %s\n", req.Token)
		fmt.Printf("   └─ Contact is nil: %v\n", contact == nil)
		if err != nil {
			fmt.Printf("   └─ Error Type: %T\n", err)
			fmt.Printf("   └─ Error Message: %v\n", err)
			fmt.Printf("   └─ Stack Trace: %+v\n", err)
		}
		fmt.Printf("   └─ Request Path: %s %s\n", c.Request.Method, c.Request.URL.Path)
		fmt.Printf("   └─ Client IP: %s\n", c.ClientIP())

		c.HTML(http.StatusInternalServerError, "unsubscribe_error.html", gin.H{
			"ErrorTitle":   t.ErrorTitle,
			"ErrorHeading": t.ErrorHeading,
			"ErrorMessage": t.ContactNotFoundError,
			"Lang":         lang,
			"TemplateText": i18n.GetTemplateText(lang),
		})
		return
	}

	// Unsubscribe the contact
	err = h.repo.UnsubscribeContactFromBirthdayEmails(c.Request.Context(), unsubToken.ContactID, req.Reason)
	if err != nil {
		fmt.Printf("❌ [500 ERROR] UnsubscribeContactFromBirthdayEmails failed\n")
		fmt.Printf("   └─ Tenant ID: %s\n", unsubToken.TenantID)
		fmt.Printf("   └─ Contact ID: %s\n", unsubToken.ContactID)
		fmt.Printf("   └─ Token: %s\n", req.Token)
		fmt.Printf("   └─ Reason: %v\n", req.Reason)
		fmt.Printf("   └─ Error Type: %T\n", err)
		fmt.Printf("   └─ Error Message: %v\n", err)
		fmt.Printf("   └─ Request Path: %s %s\n", c.Request.Method, c.Request.URL.Path)
		fmt.Printf("   └─ Client IP: %s\n", c.ClientIP())
		fmt.Printf("   └─ Stack Trace: %+v\n", err)

		c.HTML(http.StatusInternalServerError, "unsubscribe_error.html", gin.H{
			"ErrorTitle":   t.ErrorTitle,
			"ErrorHeading": t.ErrorHeading,
			"ErrorMessage": t.UnsubscribeFailedError,
			"Lang":         lang,
			"TemplateText": i18n.GetTemplateText(lang),
		})
		return
	}

	// Mark token as used
	err = h.repo.MarkBirthdayUnsubscribeTokenUsed(c.Request.Context(), unsubToken.ID)
	if err != nil {
		// Log error but don't fail the request since unsubscribe was successful
		fmt.Printf("Warning: Failed to mark unsubscribe token as used: %v\n", err)
	}

	// Return success response
	c.HTML(http.StatusOK, "unsubscribe_success.html", gin.H{
		"Message":        t.UnsubscribeSuccessMessage,
		"SuccessTitle":   t.SuccessTitle,
		"SuccessHeading": t.SuccessHeading,
		"Contact":        contact,
		"Token":          unsubToken.Token,
		"UnsubscribedAt": time.Now().Format("January 2, 2006 at 3:04 PM"),
		"Lang":           lang,
		"Translations":   t,
	})
}

// getStringValue safely gets string value from pointer
func getStringValue(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

// ProcessBirthdayResubscribe processes the resubscribe request
func (h *BirthdayHandler) ProcessBirthdayResubscribe(c *gin.Context) {
	// Detect language
	lang := c.Query("lang")
	if lang == "" {
		acceptLang := c.GetHeader("Accept-Language")
		lang = i18n.DetectLanguage(acceptLang)
	}
	t := i18n.GetTranslations(lang)

	token := c.Query("token")
	if token == "" {
		c.HTML(http.StatusBadRequest, "unsubscribe_error.html", gin.H{
			"ErrorTitle":    t.ErrorTitle,
			"ErrorHeading":  t.ErrorHeading,
			"ErrorMessage":  t.TokenMissingError,
			"Lang":          lang,
			"TemplateText":  i18n.GetTemplateText(lang),
		})
		return
	}

	// Get unsubscribe token from database
	unsubToken, err := h.repo.GetBirthdayUnsubscribeToken(c.Request.Context(), token)
	if err != nil {
		fmt.Printf("❌ [500 ERROR] GetBirthdayUnsubscribeToken failed (ProcessBirthdayResubscribe)\n")
		fmt.Printf("   └─ Token: %s\n", token)
		fmt.Printf("   └─ Error Type: %T\n", err)
		fmt.Printf("   └─ Error Message: %v\n", err)
		fmt.Printf("   └─ Request Path: %s %s\n", c.Request.Method, c.Request.URL.Path)
		fmt.Printf("   └─ Client IP: %s\n", c.ClientIP())
		fmt.Printf("   └─ Stack Trace: %+v\n", err)

		c.HTML(http.StatusInternalServerError, "unsubscribe_error.html", gin.H{
			"ErrorMessage": "Failed to process resubscribe request. Please try again later.",
		})
		return
	}

	if unsubToken == nil {
		c.HTML(http.StatusNotFound, "unsubscribe_error.html", gin.H{
			"ErrorMessage": "Invalid resubscribe link. Token not found.",
		})
		return
	}

	// Get contact information
	contact, err := h.repo.GetContactByID(c.Request.Context(), unsubToken.TenantID, unsubToken.ContactID)
	if err != nil || contact == nil {
		fmt.Printf("❌ [500 ERROR] GetContactByID failed (ProcessBirthdayResubscribe)\n")
		fmt.Printf("   └─ Tenant ID: %s\n", unsubToken.TenantID)
		fmt.Printf("   └─ Contact ID: %s\n", unsubToken.ContactID)
		fmt.Printf("   └─ Token: %s\n", token)
		fmt.Printf("   └─ Contact is nil: %v\n", contact == nil)
		if err != nil {
			fmt.Printf("   └─ Error Type: %T\n", err)
			fmt.Printf("   └─ Error Message: %v\n", err)
			fmt.Printf("   └─ Stack Trace: %+v\n", err)
		}
		fmt.Printf("   └─ Request Path: %s %s\n", c.Request.Method, c.Request.URL.Path)
		fmt.Printf("   └─ Client IP: %s\n", c.ClientIP())

		c.HTML(http.StatusInternalServerError, "unsubscribe_error.html", gin.H{
			"ErrorMessage": "Failed to find contact information.",
		})
		return
	}

	// Resubscribe the contact
	err = h.repo.ResubscribeContactToBirthdayEmails(c.Request.Context(), unsubToken.ContactID)
	if err != nil {
		fmt.Printf("❌ [500 ERROR] ResubscribeContactToBirthdayEmails failed\n")
		fmt.Printf("   └─ Tenant ID: %s\n", unsubToken.TenantID)
		fmt.Printf("   └─ Contact ID: %s\n", unsubToken.ContactID)
		fmt.Printf("   └─ Token: %s\n", token)
		fmt.Printf("   └─ Error Type: %T\n", err)
		fmt.Printf("   └─ Error Message: %v\n", err)
		fmt.Printf("   └─ Request Path: %s %s\n", c.Request.Method, c.Request.URL.Path)
		fmt.Printf("   └─ Client IP: %s\n", c.ClientIP())
		fmt.Printf("   └─ Stack Trace: %+v\n", err)

		c.HTML(http.StatusInternalServerError, "unsubscribe_error.html", gin.H{
			"ErrorMessage": "Failed to resubscribe to birthday emails",
		})
		return
	}

	// Reset the token's used status so it can be used for future unsubscribe requests
	err = h.repo.ResetBirthdayUnsubscribeToken(c.Request.Context(), unsubToken.ID)
	if err != nil {
		// Log error but don't fail the request since resubscribe was successful
		fmt.Printf("Warning: Failed to reset unsubscribe token status: %v\n", err)
	}

	// Return success response
	c.HTML(http.StatusOK, "unsubscribe_success.html", gin.H{
		"Message":        "You have been successfully resubscribed to birthday emails.",
		"Contact":        contact,
		"Token":          token,
		"UnsubscribedAt": "",
	})
}

// getBoolValue safely gets a bool value from a pointer, defaulting to false if nil
func getBoolValue(b *bool) bool {
	if b == nil {
		return false
	}
	return *b
}
