package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/gorilla/mux"
	"go.temporal.io/sdk/client"
)

type EmailTrackingEntry struct {
	ID               string                 `json:"id"`
	UserID           string                 `json:"userId"`
	TenantID         string                 `json:"tenantId"`
	EmailID          string                 `json:"emailId"`
	Status           string                 `json:"status"`
	Timestamp        time.Time              `json:"timestamp"`
	TemporalWorkflow string                 `json:"temporalWorkflow,omitempty"`
	Metadata         map[string]interface{} `json:"metadata,omitempty"`
}

type EmailTrackingRequest struct {
	EmailID          string                 `json:"emailId"`
	Status           string                 `json:"status"`
	TemporalWorkflow string                 `json:"temporalWorkflow,omitempty"`
	Metadata         map[string]interface{} `json:"metadata,omitempty"`
}

type JWTClaims struct {
	UserID   string `json:"userId"`
	TenantID string `json:"tenantId"`
	jwt.RegisteredClaims
}

type Server struct {
	temporalClient client.Client
	jwtSecret      string
}

// Store for email tracking entries (in production, this would be a database)
var emailTrackingStore = make(map[string]EmailTrackingEntry)

func main() {
	server := &Server{
		jwtSecret: getEnvOrDefault("JWT_SECRET", "Cvgii9bYKF1HtfD8TODRyZFTmFP4vu70oR59YrjGVpS2fXzQ41O3UPRaR8u9uAqNhwK5ZxZPbX5rAOlMrqe8ag=="),
	}

	// Initialize Temporal client with retry logic
	if err := server.initTemporal(); err != nil {
		log.Fatalf("Failed to initialize Temporal client: %v", err)
	}
	defer server.temporalClient.Close()

	// Setup routes
	router := mux.NewRouter()

	// Health check endpoint
	router.HandleFunc("/health", server.healthCheck).Methods("GET")

	// Email tracking endpoints (protected)
	api := router.PathPrefix("/api").Subrouter()
	api.Use(server.jwtMiddleware)

	api.HandleFunc("/email-tracking", server.createEmailTracking).Methods("POST")
	api.HandleFunc("/email-tracking", server.getEmailTrackings).Methods("GET")
	api.HandleFunc("/email-tracking/{id}", server.getEmailTracking).Methods("GET")
	api.HandleFunc("/email-tracking/{id}", server.updateEmailTracking).Methods("PUT")
	api.HandleFunc("/email-tracking/{id}", server.deleteEmailTracking).Methods("DELETE")

	port := getEnvOrDefault("PORT", "3501")
	log.Printf("Starting Go server on port %s", port)
	log.Printf("Temporal server connection: ✅ Connected")

	if err := http.ListenAndServe(":"+port, enableCORS(router)); err != nil {
		log.Fatalf("Server failed to start: %v", err)
	}
}

func (s *Server) initTemporal() error {
	temporalHost := getEnvOrDefault("TEMPORAL_HOST", "127.0.0.1:7233")
	temporalHost := getEnvOrDefault("TEMPORAL_HOST", "127.0.0.1:7233")
	maxRetries := 5
	retryDelay := 2 * time.Second

	log.Printf("Attempting to connect to Temporal server at %s", temporalHost)

	for attempt := 1; attempt <= maxRetries; attempt++ {
		log.Printf("Temporal connection attempt %d/%d", attempt, maxRetries)

		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		c, err := client.Dial(client.Options{
			HostPort: temporalHost,
		})

		if err != nil {
			log.Printf("Attempt %d failed: %v", attempt, err)
			if attempt == maxRetries {
				return fmt.Errorf("failed to connect to Temporal after %d attempts: %v", maxRetries, err)
			}
			time.Sleep(retryDelay)
			continue
		}

		// Test the connection by checking server health
		_, err = c.CheckHealth(ctx, nil)
		if err != nil {
			log.Printf("Temporal health check failed on attempt %d: %v", attempt, err)
			c.Close()
			if attempt == maxRetries {
				return fmt.Errorf("Temporal health check failed after %d attempts: %v", maxRetries, err)
			}
			time.Sleep(retryDelay)
			continue
		}

		s.temporalClient = c
		log.Printf("✅ Successfully connected to Temporal server")
		return nil
	}

	return fmt.Errorf("exhausted all retry attempts")
}

func (s *Server) jwtMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		log.Printf("🔍 [JWT] Processing request to %s", r.URL.Path)

		authHeader := r.Header.Get("Authorization")
		if authHeader == "" {
			log.Printf("❌ [JWT] No Authorization header provided")
			http.Error(w, "Authorization header required", http.StatusUnauthorized)
			return
		}

		tokenString := strings.TrimPrefix(authHeader, "Bearer ")
		if tokenString == authHeader {
			log.Printf("❌ [JWT] Invalid Authorization header format (missing Bearer prefix)")
			http.Error(w, "Bearer token required", http.StatusUnauthorized)
			return
		}

		log.Printf("🔍 [JWT] Token received (length: %d)", len(tokenString))
		log.Printf("🔍 [JWT] Token preview: %s...", tokenString[:min(50, len(tokenString))])

		token, err := jwt.ParseWithClaims(tokenString, &JWTClaims{}, func(token *jwt.Token) (interface{}, error) {
			log.Printf("🔍 [JWT] Token algorithm: %v", token.Header["alg"])
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				log.Printf("❌ [JWT] Unexpected signing method: %v", token.Header["alg"])
				return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
			}
			log.Printf("🔍 [JWT] Using JWT secret (length: %d)", len(s.jwtSecret))
			return []byte(s.jwtSecret), nil
		})

		if err != nil {
			log.Printf("❌ [JWT] Token validation error: %v", err)
			log.Printf("🔍 [JWT] JWT secret being used: %s...", s.jwtSecret[:min(20, len(s.jwtSecret))])
			http.Error(w, "Invalid token", http.StatusUnauthorized)
			return
		}

		claims, ok := token.Claims.(*JWTClaims)
		if !ok {
			log.Printf("❌ [JWT] Failed to parse token claims")
			http.Error(w, "Invalid token claims", http.StatusUnauthorized)
			return
		}

		if !token.Valid {
			log.Printf("❌ [JWT] Token is not valid")
			http.Error(w, "Invalid token", http.StatusUnauthorized)
			return
		}

		log.Printf("🔍 [JWT] Claims parsed - UserID: %s, TenantID: %s", claims.UserID, claims.TenantID)

		// Add user info to request context
		ctx := context.WithValue(r.Context(), "userID", claims.UserID)
		ctx = context.WithValue(ctx, "tenantID", claims.TenantID)

		log.Printf("✅ [JWT] User authenticated: %s (tenant: %s)", claims.UserID, claims.TenantID)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// Helper function for min
func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

func (s *Server) healthCheck(w http.ResponseWriter, r *http.Request) {
	status := map[string]interface{}{
		"status":   "healthy",
		"temporal": "connected",
		"time":     time.Now().UTC(),
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(status)
}

func (s *Server) createEmailTracking(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value("userID").(string)
	tenantID := r.Context().Value("tenantID").(string)

	var req EmailTrackingRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid JSON payload", http.StatusBadRequest)
		return
	}

	if req.EmailID == "" || req.Status == "" {
		http.Error(w, "emailId and status are required", http.StatusBadRequest)
		return
	}

	entry := EmailTrackingEntry{
		ID:               generateID(),
		UserID:           userID,
		TenantID:         tenantID,
		EmailID:          req.EmailID,
		Status:           req.Status,
		Timestamp:        time.Now().UTC(),
		TemporalWorkflow: req.TemporalWorkflow,
		Metadata:         req.Metadata,
	}

	emailTrackingStore[entry.ID] = entry

	log.Printf("📧 Created email tracking entry: %s for user %s (status: %s)", entry.ID, userID, req.Status)

	// Start Temporal workflow if connected
	if s.temporalClient != nil {
		go s.startEmailWorkflow(entry)
	} else {
		log.Printf("⚠️ Temporal client not available, skipping workflow start for entry %s", entry.ID)
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(entry)
}

func (s *Server) getEmailTrackings(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value("userID").(string)
	tenantID := r.Context().Value("tenantID").(string)

	var userEntries []EmailTrackingEntry
	for _, entry := range emailTrackingStore {
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

func (s *Server) getEmailTracking(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value("userID").(string)
	tenantID := r.Context().Value("tenantID").(string)

	vars := mux.Vars(r)
	id := vars["id"]

	entry, exists := emailTrackingStore[id]
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

func (s *Server) updateEmailTracking(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value("userID").(string)
	tenantID := r.Context().Value("tenantID").(string)

	vars := mux.Vars(r)
	id := vars["id"]

	entry, exists := emailTrackingStore[id]
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

	emailTrackingStore[id] = entry

	log.Printf("📧 Updated email tracking entry: %s (status: %s)", id, entry.Status)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(entry)
}

func (s *Server) deleteEmailTracking(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value("userID").(string)
	tenantID := r.Context().Value("tenantID").(string)

	vars := mux.Vars(r)
	id := vars["id"]

	entry, exists := emailTrackingStore[id]
	if !exists {
		http.Error(w, "Entry not found", http.StatusNotFound)
		return
	}

	if entry.UserID != userID || entry.TenantID != tenantID {
		http.Error(w, "Access denied", http.StatusForbidden)
		return
	}

	delete(emailTrackingStore, id)

	log.Printf("📧 Deleted email tracking entry: %s", id)

	w.WriteHeader(http.StatusNoContent)
}

func enableCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")

		// Define allowed origins
		allowedOrigins := []string{
			"http://localhost:5173",           // Local development (Vite)
			"http://localhost:3500",           // Local development (main app)
			"https://app.zendwise.work",       // Production main app
			"https://zendwise.work",           // Production main domain
			"https://tenginex.zendwise.work",   // Go server subdomain
			"https://authentik.zendwise.work", // Authentik subdomain if exists
			"https://637573c3-49ca-4c2a-a66f-8a199454d465-00-1y6orip6wcu6p.janeway.replit.dev", // Replit development domain
		}

		// Check if origin is allowed
		originAllowed := false
		for _, allowedOrigin := range allowedOrigins {
			if origin == allowedOrigin {
				originAllowed = true
				break
			}
		}

		// Set CORS headers
		if originAllowed {
			w.Header().Set("Access-Control-Allow-Origin", origin)
		} else {
			// Fallback to wildcard for development/testing
			w.Header().Set("Access-Control-Allow-Origin", "*")
		}

		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		w.Header().Set("Access-Control-Allow-Credentials", "true")
		w.Header().Set("Access-Control-Max-Age", "86400") // 24 hours

		// Handle preflight requests
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		next.ServeHTTP(w, r)
	})
}

func getEnvOrDefault(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func (s *Server) startEmailWorkflow(entry EmailTrackingEntry) {
	log.Printf("🔄 Starting Temporal workflow for email: %s", entry.EmailID)

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// Determine task queue and workflow based on provider
	taskQueue := "email-task-queue" // Default to Resend
	workflowName := "EmailWorkflow" // Default workflow

	// Check if Postmark provider is specified in metadata
	if entry.Metadata != nil {
		if provider, ok := entry.Metadata["emailProvider"].(string); ok {
			if provider == "postmark" {
				taskQueue = "postmark-email-task-queue"
				workflowName = "PostmarkEmailWorkflow"
				log.Printf("📮 Routing to Postmark workflow: %s", entry.EmailID)
			}
		}
	}

	workflowOptions := client.StartWorkflowOptions{
		ID:        entry.TemporalWorkflow,
		TaskQueue: taskQueue,
	}

	log.Printf("🔄 Starting workflow: %s on task queue: %s", workflowName, taskQueue)
	workflowRun, err := s.temporalClient.ExecuteWorkflow(ctx, workflowOptions, workflowName, entry)
	if err != nil {
		log.Printf("❌ Failed to start workflow for email %s: %v", entry.EmailID, err)
		// Update entry status to failed
		entry.Status = "workflow_failed"
		entry.Metadata["error"] = err.Error()
		emailTrackingStore[entry.ID] = entry
		return
	}

	log.Printf("✅ Started workflow for email %s, workflow ID: %s, run ID: %s",
		entry.EmailID, workflowRun.GetID(), workflowRun.GetRunID())

	// Update entry with workflow information
	entry.Status = "workflow_started"
	if entry.Metadata == nil {
		entry.Metadata = make(map[string]interface{})
	}
	entry.Metadata["workflowRunId"] = workflowRun.GetRunID()
	entry.Metadata["workflowStatus"] = "started"
	emailTrackingStore[entry.ID] = entry

	// Asynchronously wait for workflow completion
	go s.monitorWorkflow(workflowRun, entry)
}

func (s *Server) monitorWorkflow(workflowRun client.WorkflowRun, entry EmailTrackingEntry) {
	log.Printf("👀 Monitoring workflow for email: %s", entry.EmailID)

	var result interface{}
	err := workflowRun.Get(context.Background(), &result)

	// Update the entry with final status
	if err != nil {
		log.Printf("❌ Workflow failed for email %s: %v", entry.EmailID, err)
		entry.Status = "workflow_failed"
		if entry.Metadata == nil {
			entry.Metadata = make(map[string]interface{})
		}
		entry.Metadata["workflowError"] = err.Error()
		entry.Metadata["workflowStatus"] = "failed"
	} else {
		log.Printf("✅ Workflow completed for email %s", entry.EmailID)
		entry.Status = "sent"
		if entry.Metadata == nil {
			entry.Metadata = make(map[string]interface{})
		}
		entry.Metadata["workflowResult"] = result
		entry.Metadata["workflowStatus"] = "completed"
	}

	entry.Timestamp = time.Now().UTC()
	emailTrackingStore[entry.ID] = entry
}

func generateID() string {
	return fmt.Sprintf("%d", time.Now().UnixNano())
}
