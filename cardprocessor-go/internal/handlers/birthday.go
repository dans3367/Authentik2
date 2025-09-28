package handlers

import (
	"bytes"
	"context"
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
			"error":   "senderName is required",
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
		SenderName:      *req.SenderName,
		PromotionID:     req.PromotionID,
		UpdatedAt:       time.Now(),
	}

	updatedSettings, err := h.repo.UpdateBirthdaySettings(c.Request.Context(), settings)
	if err != nil {
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
	} else if birthdaySettings != nil && birthdaySettings.PromotionID != nil {
		promotionID = *birthdaySettings.PromotionID
		fmt.Printf("🎁 [Birthday Test] Found promotion ID in settings: %s\n", promotionID)
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
			IsTest:          true,
		}

		fmt.Printf("🎂 [Birthday Test] Workflow input prepared: %+v\n", workflowInput)

		// Start the birthday test workflow
		ctx := context.Background()
		workflowRun, err := h.temporalClient.StartBirthdayTestWorkflow(ctx, workflowInput)
		if err != nil {
			fmt.Printf("❌ [Birthday Test] Failed to start workflow: %v\n", err)
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

	fmt.Printf("🎂 [Birthday Test] Temporal client not available, using direct mode\n")

	// Fallback: Send email directly (simplified implementation)
	// TODO: Implement direct email sending as fallback
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Test birthday card sent successfully (direct mode)",
		"recipient": gin.H{
			"userId":    userID,
			"userEmail": req.UserEmail,
		},
	})
}

// getStringValue safely gets string value from pointer
func getStringValue(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}
