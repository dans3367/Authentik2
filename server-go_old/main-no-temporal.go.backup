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
	jwtSecret string
}

var emailTrackingStore = make(map[string]EmailTrackingEntry)

func main() {
	server := &Server{
		jwtSecret: getEnvOrDefault("JWT_SECRET", "Cvgii9bYKF1HtfD8TODRyZFTmFP4vu70oR59YrjGVpS2fXzQ41O3UPRaR8u9uAqNhwK5ZxZPbX5rAOlMrqe8ag=="),
	}

	router := mux.NewRouter()

	router.HandleFunc("/health", server.healthCheck).Methods("GET")

	api := router.PathPrefix("/api").Subrouter()
	api.Use(server.jwtMiddleware)

	api.HandleFunc("/email-tracking", server.createEmailTracking).Methods("POST")
	api.HandleFunc("/email-tracking", server.getEmailTrackings).Methods("GET")
	api.HandleFunc("/email-tracking/{id}", server.getEmailTracking).Methods("GET")
	api.HandleFunc("/email-tracking/{id}", server.updateEmailTracking).Methods("PUT")
	api.HandleFunc("/email-tracking/{id}", server.deleteEmailTracking).Methods("DELETE")

	port := getEnvOrDefault("PORT", "3501")
	log.Printf("🚀 Email Tracking Go Server starting on port %s", port)
	log.Printf("⚠️  Running in NO-TEMPORAL mode for testing")
	log.Printf("✅ Ready to accept requests")

	if err := http.ListenAndServe("0.0.0.0:"+port, enableCORS(router)); err != nil {
		log.Fatalf("Server failed to start: %v", err)
	}
}

func (s *Server) jwtMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" {
			http.Error(w, "Authorization header required", http.StatusUnauthorized)
			return
		}

		tokenString := strings.TrimPrefix(authHeader, "Bearer ")
		if tokenString == authHeader {
			http.Error(w, "Bearer token required", http.StatusUnauthorized)
			return
		}

		token, err := jwt.ParseWithClaims(tokenString, &JWTClaims{}, func(token *jwt.Token) (interface{}, error) {
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
			}
			return []byte(s.jwtSecret), nil
		})

		if err != nil {
			log.Printf("JWT validation error: %v", err)
			http.Error(w, "Invalid token", http.StatusUnauthorized)
			return
		}

		claims, ok := token.Claims.(*JWTClaims)
		if !ok || !token.Valid {
			http.Error(w, "Invalid token claims", http.StatusUnauthorized)
			return
		}

		ctx := context.WithValue(r.Context(), "userID", claims.UserID)
		ctx = context.WithValue(ctx, "tenantID", claims.TenantID)

		log.Printf("🔐 User authenticated: %s (tenant: %s)", claims.UserID, claims.TenantID)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func (s *Server) healthCheck(w http.ResponseWriter, r *http.Request) {
	status := map[string]interface{}{
		"status":   "healthy",
		"temporal": "not connected (test mode)",
		"time":     time.Now().UTC(),
		"mode":     "no-temporal",
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
	}

	delete(emailTrackingStore, id)

	log.Printf("📧 Deleted email tracking entry: %s", id)

	w.WriteHeader(http.StatusNoContent)
}

func enableCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

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

func generateID() string {
	return fmt.Sprintf("%d", time.Now().UnixNano())
}
