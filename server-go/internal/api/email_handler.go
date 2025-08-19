package api

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"email-tracking-server/internal/activities"
	"email-tracking-server/internal/client"
	"email-tracking-server/pkg/logger"

	"github.com/golang-jwt/jwt/v5"
	"github.com/gorilla/mux"
	temporalclient "go.temporal.io/sdk/client"
)

type EmailHandler struct {
	temporalClient *client.TemporalClient
	taskQueue      string
	jwtSecret      string
	logger         *logger.Logger
	// In-memory store for demo purposes - in production use a database
	trackingStore map[string]EmailTrackingEntry
	// Reverse index from ResendID to tracking entry ID for efficient lookup
	resendIdIndex map[string]string
	// Store for used approval tokens to prevent reuse
	usedTokens map[string]time.Time
}

type EmailTrackingEntry struct {
	ID               string                 `json:"id"`
	UserID           string                 `json:"userId"`
	TenantID         string                 `json:"tenantId"`
	EmailID          string                 `json:"emailId"`
	Status           string                 `json:"status"`
	Timestamp        time.Time              `json:"timestamp"`
	ScheduledAt      *time.Time             `json:"scheduledAt,omitempty"`
	Timezone         string                 `json:"timezone,omitempty"`
	TemporalWorkflow string                 `json:"temporalWorkflow,omitempty"`
	Metadata         map[string]interface{} `json:"metadata,omitempty"`
}

type EmailTrackingRequest struct {
	EmailID          string                 `json:"emailId"`
	Status           string                 `json:"status"`
	ScheduledAt      string                 `json:"scheduledAt,omitempty"`
	Timezone         string                 `json:"timezone,omitempty"`
	TemporalWorkflow string                 `json:"temporalWorkflow,omitempty"`
	Metadata         map[string]interface{} `json:"metadata,omitempty"`
}

type JWTClaims struct {
	UserID   string `json:"userId"`
	TenantID string `json:"tenantId"`
	jwt.RegisteredClaims
}

func NewEmailHandler(temporalClient *client.TemporalClient, taskQueue string, jwtSecret string, log *logger.Logger) *EmailHandler {
	return &EmailHandler{
		temporalClient: temporalClient,
		taskQueue:      taskQueue,
		jwtSecret:      jwtSecret,
		logger:         log,
		trackingStore:  make(map[string]EmailTrackingEntry),
		resendIdIndex:  make(map[string]string),
		usedTokens:     make(map[string]time.Time),
	}
}

func (eh *EmailHandler) JWTMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		logger := eh.logger.WithContext(r.Context())
		logger.Info("Processing JWT authentication", "path", r.URL.Path)

		authHeader := r.Header.Get("Authorization")
		if authHeader == "" {
			logger.Warn("No Authorization header provided")
			http.Error(w, "Authorization header required", http.StatusUnauthorized)
			return
		}

		tokenString := strings.TrimPrefix(authHeader, "Bearer ")
		if tokenString == authHeader {
			logger.Warn("Invalid Authorization header format")
			http.Error(w, "Bearer token required", http.StatusUnauthorized)
			return
		}

		token, err := jwt.ParseWithClaims(tokenString, &JWTClaims{}, func(token *jwt.Token) (interface{}, error) {
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
			}
			return []byte(eh.jwtSecret), nil
		})

		if err != nil {
			logger.Error("Token validation error", "error", err)
			http.Error(w, "Invalid token", http.StatusUnauthorized)
			return
		}

		claims, ok := token.Claims.(*JWTClaims)
		if !ok || !token.Valid {
			logger.Error("Invalid token claims")
			http.Error(w, "Invalid token", http.StatusUnauthorized)
			return
		}

		logger.Info("User authenticated", "user_id", claims.UserID, "tenant_id", claims.TenantID)

		// Add user info to request context
		ctx := context.WithValue(r.Context(), "userID", claims.UserID)
		ctx = context.WithValue(ctx, "tenantID", claims.TenantID)

		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func (eh *EmailHandler) CreateEmailTracking(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value("userID").(string)
	tenantID := r.Context().Value("tenantID").(string)
	logger := eh.logger.WithContext(r.Context())

	var req EmailTrackingRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		logger.Error("Invalid JSON payload", "error", err)
		http.Error(w, "Invalid JSON payload", http.StatusBadRequest)
		return
	}

	if req.EmailID == "" || req.Status == "" {
		logger.Error("Missing required fields", "email_id", req.EmailID, "status", req.Status)
		http.Error(w, "emailId and status are required", http.StatusBadRequest)
		return
	}

	// If reviewer approval is required, force status to awaiting_approval to prevent immediate send
	// This guards against clients accidentally sending queued/scheduled
	if req.Metadata != nil {
		if v, ok := req.Metadata["requiresReviewerApproval"].(bool); ok && v {
			req.Status = "awaiting_approval"
		}
	}

	var scheduledAt *time.Time
	var timezone string
	if req.ScheduledAt != "" {
		if parsedTime, err := time.Parse(time.RFC3339, req.ScheduledAt); err == nil {
			// Convert to UTC to ensure consistent timezone handling
			utcTime := parsedTime.UTC()
			scheduledAt = &utcTime
			timezone = req.Timezone

			logger.Info("Parsed scheduled time",
				"original", req.ScheduledAt,
				"timezone", req.Timezone,
				"parsed_local", parsedTime,
				"parsed_utc", utcTime,
				"current_utc", time.Now().UTC())
		} else {
			logger.Error("Invalid scheduledAt format", "error", err, "scheduledAt", req.ScheduledAt)
			http.Error(w, "Invalid scheduledAt format, expected RFC3339", http.StatusBadRequest)
			return
		}
	}

	entry := EmailTrackingEntry{
		ID:               generateID(),
		UserID:           userID,
		TenantID:         tenantID,
		EmailID:          req.EmailID,
		Status:           req.Status,
		Timestamp:        time.Now().UTC(),
		ScheduledAt:      scheduledAt,
		Timezone:         timezone,
		TemporalWorkflow: req.TemporalWorkflow,
		Metadata:         req.Metadata,
	}

	eh.trackingStore[entry.ID] = entry

	logger.Info("Created email tracking entry",
		"entry_id", entry.ID,
		"email_id", entry.EmailID,
		"initial_status", req.Status,
		"final_status", entry.Status,
		"scheduled_at", scheduledAt,
		"has_scheduled_at", entry.ScheduledAt != nil,
		"metadata", entry.Metadata)

	// Start Temporal workflow with detailed debugging
	isScheduled := entry.Status == "scheduled" && entry.ScheduledAt != nil
	logger.Info("Workflow routing decision",
		"entry_status", entry.Status,
		"has_scheduled_at", entry.ScheduledAt != nil,
		"is_scheduled", isScheduled)

	// Reviewer approval path - check both metadata and status
	requiresApproval := false
	if entry.Metadata != nil {
		if v, ok := entry.Metadata["requiresReviewerApproval"].(bool); ok {
			requiresApproval = v
			logger.Info("Reviewer approval metadata check", "requiresReviewerApproval", v)
		}
	}
	// Also support status-based routing for robustness
	if strings.EqualFold(entry.Status, "awaiting_approval") {
		requiresApproval = true
		logger.Info("Status-based approval routing", "status", entry.Status)
	}

	logger.Info("Workflow routing decision detailed",
		"entry_status", entry.Status,
		"requires_approval", requiresApproval,
		"has_scheduled_at", entry.ScheduledAt != nil,
		"is_scheduled", isScheduled)

	if requiresApproval {
		logger.Info("Routing to reviewer approval workflow", "email_id", entry.EmailID)
		// Ensure the entry reflects awaiting_approval immediately
		entry.Status = "awaiting_approval"
		eh.trackingStore[entry.ID] = entry
		go eh.startReviewerApprovalWorkflow(entry)
	} else if isScheduled {
		logger.Info("Routing to scheduled workflow", "email_id", entry.EmailID)
		go eh.scheduleEmailWorkflow(entry)
	} else {
		logger.Info("Routing to immediate workflow", "email_id", entry.EmailID)
		go eh.startEmailWorkflow(entry)
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(entry)
}

func (eh *EmailHandler) GetEmailTrackings(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value("userID").(string)
	tenantID := r.Context().Value("tenantID").(string)

	var userEntries []EmailTrackingEntry
	for _, entry := range eh.trackingStore {
		if entry.UserID == userID && entry.TenantID == tenantID {
			userEntries = append(userEntries, entry)
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"entries": userEntries,
		"count":   len(userEntries),
	})
}

func (eh *EmailHandler) GetEmailTracking(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value("userID").(string)
	tenantID := r.Context().Value("tenantID").(string)

	vars := mux.Vars(r)
	id := vars["id"]

	entry, exists := eh.trackingStore[id]
	if !exists {
		http.Error(w, "Entry not found", http.StatusNotFound)
		return
	}

	if entry.UserID != userID || entry.TenantID != tenantID {
		http.Error(w, "Access denied", http.StatusForbidden)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(entry)
}

func (eh *EmailHandler) UpdateEmailTracking(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value("userID").(string)
	tenantID := r.Context().Value("tenantID").(string)

	vars := mux.Vars(r)
	id := vars["id"]

	entry, exists := eh.trackingStore[id]
	if !exists {
		http.Error(w, "Entry not found", http.StatusNotFound)
		return
	}

	if entry.UserID != userID || entry.TenantID != tenantID {
		http.Error(w, "Access denied", http.StatusForbidden)
		return
	}

	var req EmailTrackingRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid JSON payload", http.StatusBadRequest)
		return
	}

	// Update the entry
	if req.Status != "" {
		entry.Status = req.Status
	}
	if req.TemporalWorkflow != "" {
		entry.TemporalWorkflow = req.TemporalWorkflow
	}
	if req.Metadata != nil {
		entry.Metadata = req.Metadata
	}
	entry.Timestamp = time.Now().UTC()

	eh.trackingStore[id] = entry

	eh.logger.Info("Updated email tracking entry", "entry_id", id, "status", entry.Status)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(entry)
}

func (eh *EmailHandler) DeleteEmailTracking(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value("userID").(string)
	tenantID := r.Context().Value("tenantID").(string)

	vars := mux.Vars(r)
	id := vars["id"]

	entry, exists := eh.trackingStore[id]
	if !exists {
		http.Error(w, "Entry not found", http.StatusNotFound)
		return
	}

	if entry.UserID != userID || entry.TenantID != tenantID {
		http.Error(w, "Access denied", http.StatusForbidden)
		return
	}

	delete(eh.trackingStore, id)

	eh.logger.Info("Deleted email tracking entry", "entry_id", id)

	w.WriteHeader(http.StatusNoContent)
}

// GetEmailTrackingByResendID retrieves email tracking entry by ResendID
func (eh *EmailHandler) GetEmailTrackingByResendID(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value("userID").(string)
	tenantID := r.Context().Value("tenantID").(string)

	vars := mux.Vars(r)
	resendID := vars["resendId"]

	// Lookup tracking entry ID by ResendID
	trackingEntryID, exists := eh.resendIdIndex[resendID]
	if !exists {
		http.Error(w, "Email not found by ResendID", http.StatusNotFound)
		return
	}

	// Get the actual tracking entry
	entry, exists := eh.trackingStore[trackingEntryID]
	if !exists {
		// This should not happen, but handle gracefully
		http.Error(w, "Tracking entry inconsistency", http.StatusInternalServerError)
		eh.logger.Error("ResendID index points to non-existent tracking entry",
			"resend_id", resendID, "tracking_id", trackingEntryID)
		return
	}

	// Verify user access
	if entry.UserID != userID || entry.TenantID != tenantID {
		http.Error(w, "Access denied", http.StatusForbidden)
		return
	}

	eh.logger.Info("Retrieved email tracking by ResendID", "resend_id", resendID, "tracking_id", trackingEntryID)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(entry)
}

// UpdateEmailTrackingResendID allows manual updates of ResendID for existing tracking entries
// This is useful for webhook processing when ResendID is discovered later
func (eh *EmailHandler) UpdateEmailTrackingResendID(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value("userID").(string)
	tenantID := r.Context().Value("tenantID").(string)

	vars := mux.Vars(r)
	id := vars["id"]

	entry, exists := eh.trackingStore[id]
	if !exists {
		http.Error(w, "Entry not found", http.StatusNotFound)
		return
	}

	if entry.UserID != userID || entry.TenantID != tenantID {
		http.Error(w, "Access denied", http.StatusForbidden)
		return
	}

	var req struct {
		ResendID string `json:"resendId"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid JSON payload", http.StatusBadRequest)
		return
	}

	if req.ResendID == "" {
		http.Error(w, "resendId is required", http.StatusBadRequest)
		return
	}

	// Update the tracking entry with ResendID
	if entry.Metadata == nil {
		entry.Metadata = make(map[string]interface{})
	}
	entry.Metadata["resendId"] = req.ResendID
	entry.Metadata["resendIdUpdatedViaWebhook"] = true
	entry.Metadata["resendIdUpdatedAt"] = time.Now().UTC().Format(time.RFC3339)
	entry.Timestamp = time.Now().UTC()

	// Update the ResendID index
	eh.resendIdIndex[req.ResendID] = entry.ID

	// Store the updated entry
	eh.trackingStore[id] = entry

	eh.logger.Info("Updated ResendID for email tracking entry",
		"entry_id", id,
		"resend_id", req.ResendID,
		"updated_via", "webhook")

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(entry)
}

// CleanupResendIdIndex removes orphaned entries from the ResendID index
func (eh *EmailHandler) CleanupResendIdIndex(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value("userID").(string)
	tenantID := r.Context().Value("tenantID").(string)

	cleaned := 0
	orphaned := []string{}

	// Check each ResendID index entry
	for resendId, trackingId := range eh.resendIdIndex {
		if entry, exists := eh.trackingStore[trackingId]; !exists {
			// Entry doesn't exist, remove from index
			delete(eh.resendIdIndex, resendId)
			orphaned = append(orphaned, resendId)
			cleaned++
		} else if entry.UserID != userID || entry.TenantID != tenantID {
			// Entry belongs to different user/tenant, skip
			continue
		}
	}

	eh.logger.Info("ResendID index cleanup completed",
		"cleaned_entries", cleaned,
		"user_id", userID,
		"tenant_id", tenantID)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"message":             "ResendID index cleanup completed",
		"cleaned_entries":     cleaned,
		"orphaned_resend_ids": orphaned,
	})
}

// GetResendIdIndexStatus provides debug information about the ResendID index
func (eh *EmailHandler) GetResendIdIndexStatus(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value("userID").(string)
	tenantID := r.Context().Value("tenantID").(string)

	userIndexEntries := make(map[string]string)
	totalEntries := len(eh.resendIdIndex)
	userTrackingEntries := 0

	// Count user's tracking entries
	for _, entry := range eh.trackingStore {
		if entry.UserID == userID && entry.TenantID == tenantID {
			userTrackingEntries++
		}
	}

	// Get user's ResendID index entries
	for resendId, trackingId := range eh.resendIdIndex {
		if entry, exists := eh.trackingStore[trackingId]; exists {
			if entry.UserID == userID && entry.TenantID == tenantID {
				userIndexEntries[resendId] = trackingId
			}
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"total_resend_index_entries": totalEntries,
		"user_resend_index_entries":  len(userIndexEntries),
		"user_tracking_entries":      userTrackingEntries,
		"index_coverage_pct": func() float64 {
			if userTrackingEntries == 0 {
				return 0
			}
			return float64(len(userIndexEntries)) / float64(userTrackingEntries) * 100
		}(),
		"user_index_entries": userIndexEntries,
	})
}

func (eh *EmailHandler) startEmailWorkflow(entry EmailTrackingEntry) {
	logger := eh.logger.WithEmail(entry.EmailID)
	logger.Info("Starting Temporal email workflow")

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// Convert to activity data format
	emailData := activities.EmailData{
		ID:        entry.ID,
		UserID:    entry.UserID,
		TenantID:  entry.TenantID,
		EmailID:   entry.EmailID,
		Status:    entry.Status,
		Timestamp: entry.Timestamp,
		Workflow:  entry.TemporalWorkflow,
		Metadata:  entry.Metadata,
	}

	workflowID := fmt.Sprintf("email-workflow-%s", entry.EmailID)

	workflowRun, err := eh.temporalClient.StartEmailWorkflow(ctx, workflowID, eh.taskQueue, emailData)
	if err != nil {
		logger.Error("Failed to start email workflow", "error", err)
		// Update entry status to failed
		entry.Status = "workflow_failed"
		if entry.Metadata == nil {
			entry.Metadata = make(map[string]interface{})
		}
		entry.Metadata["error"] = err.Error()
		eh.trackingStore[entry.ID] = entry
		return
	}

	logger.Info("Started email workflow",
		"workflow_id", workflowRun.GetID(),
		"run_id", workflowRun.GetRunID())

	// Update entry with workflow information
	entry.Status = "workflow_started"
	if entry.Metadata == nil {
		entry.Metadata = make(map[string]interface{})
	}
	entry.Metadata["workflowRunId"] = workflowRun.GetRunID()
	entry.Metadata["workflowStatus"] = "started"
	eh.trackingStore[entry.ID] = entry

	// Monitor workflow completion
	go eh.monitorWorkflow(workflowRun, entry)
}

func (eh *EmailHandler) scheduleEmailWorkflow(entry EmailTrackingEntry) {
	logger := eh.logger.WithEmail(entry.EmailID)

	// Detailed logging for debugging
	now := time.Now().UTC()
	delay := entry.ScheduledAt.Sub(now)

	logger.Info("Starting scheduled Temporal email workflow",
		"scheduled_at", entry.ScheduledAt,
		"scheduled_at_utc", entry.ScheduledAt.UTC(),
		"current_time", now,
		"delay", delay,
		"delay_seconds", delay.Seconds())

	// Additional safety check
	if delay <= 0 {
		logger.Warn("Scheduled time is in the past when starting workflow",
			"scheduled_at", entry.ScheduledAt,
			"current_time", now,
			"delay", delay)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// Convert to activity data format
	emailData := activities.EmailData{
		ID:        entry.ID,
		UserID:    entry.UserID,
		TenantID:  entry.TenantID,
		EmailID:   entry.EmailID,
		Status:    entry.Status,
		Timestamp: entry.Timestamp,
		Workflow:  entry.TemporalWorkflow,
		Metadata:  entry.Metadata,
	}

	workflowID := fmt.Sprintf("scheduled-email-workflow-%s", entry.EmailID)

	workflowRun, err := eh.temporalClient.StartScheduledEmailWorkflow(ctx, workflowID, eh.taskQueue, *entry.ScheduledAt, emailData)
	if err != nil {
		logger.Error("Failed to start scheduled email workflow", "error", err)
		// Update entry status to failed
		entry.Status = "workflow_failed"
		if entry.Metadata == nil {
			entry.Metadata = make(map[string]interface{})
		}
		entry.Metadata["error"] = err.Error()
		eh.trackingStore[entry.ID] = entry
		return
	}

	logger.Info("Started scheduled email workflow",
		"workflow_id", workflowRun.GetID(),
		"run_id", workflowRun.GetRunID(),
		"scheduled_at", entry.ScheduledAt)

	// Update entry with workflow information
	entry.Status = "workflow_scheduled"
	if entry.Metadata == nil {
		entry.Metadata = make(map[string]interface{})
	}
	entry.Metadata["workflowRunId"] = workflowRun.GetRunID()
	entry.Metadata["workflowStatus"] = "scheduled"
	eh.trackingStore[entry.ID] = entry

	// Monitor workflow completion
	go eh.monitorWorkflow(workflowRun, entry)
}

func (eh *EmailHandler) startReviewerApprovalWorkflow(entry EmailTrackingEntry) {
	logger := eh.logger.WithEmail(entry.EmailID)
	logger.Info("Starting reviewer approval Temporal workflow")

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	emailData := activities.EmailData{
		ID:        entry.ID,
		UserID:    entry.UserID,
		TenantID:  entry.TenantID,
		EmailID:   entry.EmailID,
		Status:    entry.Status,
		Timestamp: entry.Timestamp,
		Workflow:  entry.TemporalWorkflow,
		Metadata:  entry.Metadata,
	}

	workflowID := fmt.Sprintf("reviewer-email-workflow-%s", entry.EmailID)

	workflowRun, err := eh.temporalClient.StartReviewerApprovalEmailWorkflow(ctx, workflowID, eh.taskQueue, emailData)
	if err != nil {
		logger.Error("Failed to start reviewer approval workflow", "error", err)
		entry.Status = "workflow_failed"
		if entry.Metadata == nil {
			entry.Metadata = make(map[string]interface{})
		}
		entry.Metadata["error"] = err.Error()
		eh.trackingStore[entry.ID] = entry
		return
	}

	logger.Info("Started reviewer approval workflow",
		"workflow_id", workflowRun.GetID(),
		"run_id", workflowRun.GetRunID())

	entry.Status = "awaiting_approval"
	if entry.Metadata == nil {
		entry.Metadata = make(map[string]interface{})
	}
	entry.Metadata["workflowRunId"] = workflowRun.GetRunID()
	entry.Metadata["workflowStatus"] = "awaiting_approval"
	eh.trackingStore[entry.ID] = entry

	go eh.monitorWorkflow(workflowRun, entry)
}

// generateTokenSignature creates a unique signature for a token to track its usage
func (eh *EmailHandler) generateTokenSignature(tokenString string) string {
	// Use SHA256 hash of the token to create a signature - this allows us to track
	// the exact token that was used without storing the full token
	hash := sha256.Sum256([]byte(tokenString))
	return hex.EncodeToString(hash[:])[:32] // Use first 32 chars of hex hash
}

// cleanupExpiredTokens removes tokens that are older than the specified duration
// This prevents the usedTokens map from growing indefinitely
func (eh *EmailHandler) cleanupExpiredTokens(maxAge time.Duration) {
	cutoff := time.Now().UTC().Add(-maxAge)
	for signature, usedAt := range eh.usedTokens {
		if usedAt.Before(cutoff) {
			delete(eh.usedTokens, signature)
		}
	}
	eh.logger.Info("Cleaned up expired tokens", "cutoff", cutoff, "remaining_tokens", len(eh.usedTokens))
}

// ApproveEmail handles approval link clicks from reviewers and signals the workflow to proceed
func (eh *EmailHandler) ApproveEmail(w http.ResponseWriter, r *http.Request) {
	logger := eh.logger.WithContext(r.Context())

	// Token contains emailId and workflowId; signed with JWT secret shared with Node backend
	tokenString := r.URL.Query().Get("token")
	if tokenString == "" {
		logger.Warn("Approval request missing token")
		http.Error(w, "token is required", http.StatusBadRequest)
		return
	}

	// Generate a signature for this token to track usage
	tokenSignature := eh.generateTokenSignature(tokenString)

	// Check if this token has already been used
	if usedAt, exists := eh.usedTokens[tokenSignature]; exists {
		logger.Warn("Attempt to reuse approval token",
			"token_signature", tokenSignature,
			"originally_used_at", usedAt)
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.WriteHeader(http.StatusConflict)
		fmt.Fprintf(w, "<html><body><h3>Token Already Used</h3><p>This approval link has already been used and cannot be used again for security reasons. If you need to approve this email again, please request a new approval link.</p></body></html>")
		return
	}

	type ApprovalClaims struct {
		EmailID    string `json:"emailId"`
		WorkflowID string `json:"workflowId"`
		jwt.RegisteredClaims
	}

	token, err := jwt.ParseWithClaims(tokenString, &ApprovalClaims{}, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return []byte(eh.jwtSecret), nil
	})
	if err != nil || !token.Valid {
		logger.Error("Invalid approval token", "error", err, "token_signature", tokenSignature)
		http.Error(w, "invalid or expired token", http.StatusUnauthorized)
		return
	}

	claims, ok := token.Claims.(*ApprovalClaims)
	if !ok {
		logger.Error("Invalid token claims", "token_signature", tokenSignature)
		http.Error(w, "invalid token claims", http.StatusUnauthorized)
		return
	}

	logger.Info("Processing approval request",
		"email_id", claims.EmailID,
		"workflow_id", claims.WorkflowID,
		"token_signature", tokenSignature)

	// Signal the workflow to approve
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	if err := eh.temporalClient.SignalApproval(ctx, claims.WorkflowID, "", "approve"); err != nil {
		logger.Error("Failed to signal workflow approval",
			"error", err,
			"workflow_id", claims.WorkflowID,
			"email_id", claims.EmailID)
		http.Error(w, "failed to signal workflow", http.StatusInternalServerError)
		return
	}

	// Mark this token as used AFTER successful approval to prevent reuse
	eh.usedTokens[tokenSignature] = time.Now().UTC()
	logger.Info("Token marked as used",
		"token_signature", tokenSignature,
		"email_id", claims.EmailID)

	// Update tracking entry status if we can find it
	for id, entry := range eh.trackingStore {
		if entry.EmailID == claims.EmailID {
			entry.Status = "approved"
			entry.Timestamp = time.Now().UTC()
			if entry.Metadata == nil {
				entry.Metadata = make(map[string]interface{})
			}
			entry.Metadata["workflowStatus"] = "approved"
			entry.Metadata["approvalTokenUsed"] = tokenSignature
			eh.trackingStore[id] = entry
			break
		}
	}

	logger.Info("Email approval completed successfully",
		"email_id", claims.EmailID,
		"workflow_id", claims.WorkflowID)

	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	fmt.Fprintf(w, "<html><body><h3>Approval received</h3><p>The email has been approved and will be sent shortly.</p></body></html>")
}

func (eh *EmailHandler) monitorWorkflow(workflowRun temporalclient.WorkflowRun, entry EmailTrackingEntry) {
	logger := eh.logger.WithEmail(entry.EmailID).WithWorkflow(workflowRun.GetID())
	logger.Info("Monitoring workflow completion")

	var result activities.SendEmailResult
	err := workflowRun.Get(context.Background(), &result)

	// Update the entry with final status
	if err != nil {
		logger.Error("Workflow failed", "error", err)
		entry.Status = "failed"
		if entry.Metadata == nil {
			entry.Metadata = make(map[string]interface{})
		}
		entry.Metadata["workflowError"] = err.Error()
		entry.Metadata["workflowStatus"] = "failed"
	} else {
		logger.Info("Workflow completed successfully", "status", result.Status, "resend_id", result.ResendID)
		// Respect workflow result status (e.g., sent, approval_timeout)
		if result.Status != "" {
			entry.Status = result.Status
		} else {
			entry.Status = "sent"
		}
		if entry.Metadata == nil {
			entry.Metadata = make(map[string]interface{})
		}
		entry.Metadata["workflowResult"] = result
		entry.Metadata["workflowStatus"] = "completed"
		entry.Metadata["resendId"] = result.ResendID

		// Add resend UUID to tags for internal tracking
		if result.ResendID != "" {
			// Update the reverse index for efficient ResendID lookup
			eh.resendIdIndex[result.ResendID] = entry.ID
			logger.Info("Updated ResendID index for tracking", "resend_id", result.ResendID, "tracking_id", entry.ID)

			if tagsInterface, exists := entry.Metadata["tags"]; exists {
				if tagsSlice, ok := tagsInterface.([]interface{}); ok {
					// Add resend UUID to existing tags
					updatedTags := make([]interface{}, len(tagsSlice)+1)
					copy(updatedTags, tagsSlice)
					updatedTags[len(tagsSlice)] = fmt.Sprintf("resendUUID-%s", result.ResendID)
					entry.Metadata["tags"] = updatedTags
					logger.Info("Added resend UUID to tags for internal tracking", "resend_id", result.ResendID)
				}
			} else {
				// Create tags array with resend UUID if none existed
				entry.Metadata["tags"] = []interface{}{fmt.Sprintf("resendUUID-%s", result.ResendID)}
				logger.Info("Created tags with resend UUID for internal tracking", "resend_id", result.ResendID)
			}
		}
	}

	entry.Timestamp = time.Now().UTC()
	eh.trackingStore[entry.ID] = entry

	logger.Info("Workflow monitoring completed", "final_status", entry.Status)
}

// ClearTemporalWorkflows terminates all running workflows and clears tracking entries
func (eh *EmailHandler) ClearTemporalWorkflows(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value("userID").(string)
	tenantID := r.Context().Value("tenantID").(string)
	logger := eh.logger.WithContext(r.Context())

	logger.Info("Starting temporal workflow cleanup operation",
		"user_id", userID,
		"tenant_id", tenantID)

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	clearedWorkflows := 0
	clearedEntries := 0

	// First, attempt to terminate all workflows for this user/tenant
	for entryID, entry := range eh.trackingStore {
		if entry.UserID == userID && entry.TenantID == tenantID {
			if entry.TemporalWorkflow != "" {
				// Try to terminate the workflow
				if eh.temporalClient != nil {
					client := eh.temporalClient.GetClient()
					err := client.TerminateWorkflow(ctx, entry.TemporalWorkflow, "", "Manual cleanup operation")
					if err != nil {
						logger.Warn("Failed to terminate workflow",
							"workflow_id", entry.TemporalWorkflow,
							"email_id", entry.EmailID,
							"error", err)
					} else {
						logger.Info("Terminated workflow",
							"workflow_id", entry.TemporalWorkflow,
							"email_id", entry.EmailID)
						clearedWorkflows++
					}
				}
			}

			// Remove the tracking entry
			delete(eh.trackingStore, entryID)
			clearedEntries++
		}
	}

	// Also clear any orphaned workflows with failed statuses
	for entryID, entry := range eh.trackingStore {
		if entry.UserID == userID && entry.TenantID == tenantID {
			if entry.Status == "failed" || entry.Status == "workflow_failed" {
				delete(eh.trackingStore, entryID)
				clearedEntries++
			}
		}
	}

	logger.Info("Temporal cleanup completed",
		"user_id", userID,
		"tenant_id", tenantID,
		"cleared_workflows", clearedWorkflows,
		"cleared_entries", clearedEntries)

	response := map[string]interface{}{
		"message":          "Temporal cleanup completed successfully",
		"clearedWorkflows": clearedWorkflows,
		"clearedEntries":   clearedEntries,
		"timestamp":        time.Now().UTC().Format(time.RFC3339),
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(response)
}

func generateID() string {
	return fmt.Sprintf("%d", time.Now().UnixNano())
}
