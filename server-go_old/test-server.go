package main

import (
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

type TestEmailTrackingEntry struct {
        ID        string    `json:"id"`
        UserID    string    `json:"userId"`
        TenantID  string    `json:"tenantId"`
        EmailID   string    `json:"emailId"`
        Status    string    `json:"status"`
        Timestamp time.Time `json:"timestamp"`
}

type TestJWTClaims struct {
        UserID   string `json:"userId"`
        TenantID string `json:"tenantId"`
        jwt.RegisteredClaims
}

type TestServer struct {
        jwtSecret string
}

var testEmailStore = make(map[string]TestEmailTrackingEntry)

func main() {
        server := &TestServer{
                jwtSecret: getEnvOrDefault("JWT_SECRET", "Cvgii9bYKF1HtfD8TODRyZFTmFP4vu70oR59YrjGVpS2fXzQ41O3UPRaR8u9uAqNhwK5ZxZPbX5rAOlMrqe8ag=="),
        }

        router := mux.NewRouter()
        router.HandleFunc("/health", server.healthCheck).Methods("GET")
        
        api := router.PathPrefix("/api").Subrouter()
        api.Use(server.jwtMiddleware)
        api.HandleFunc("/email-tracking", server.createEmailTracking).Methods("POST")
        api.HandleFunc("/email-tracking", server.getEmailTrackings).Methods("GET")

        port := getEnvOrDefault("PORT", "8081")
        log.Printf("🚀 Test Go server starting on port %s", port)
        log.Printf("✅ Ready to accept requests")
        
        httpServer := &http.Server{
                Addr:    "0.0.0.0:" + port,
                Handler: enableCORS(router),
        }
        
        log.Printf("🌐 Listening on 0.0.0.0:%s", port)
        if err := httpServer.ListenAndServe(); err != nil {
                log.Fatalf("Server failed to start: %v", err)
        }
}

func (s *TestServer) jwtMiddleware(next http.Handler) http.Handler {
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

                token, err := jwt.ParseWithClaims(tokenString, &TestJWTClaims{}, func(token *jwt.Token) (interface{}, error) {
                        return []byte(s.jwtSecret), nil
                })

                if err != nil {
                        log.Printf("JWT validation error: %v", err)
                        http.Error(w, "Invalid token", http.StatusUnauthorized)
                        return
                }

                claims, ok := token.Claims.(*TestJWTClaims)
                if !ok || !token.Valid {
                        http.Error(w, "Invalid token claims", http.StatusUnauthorized)
                        return
                }

                log.Printf("🔐 User authenticated: %s (tenant: %s)", claims.UserID, claims.TenantID)
                r.Header.Set("X-User-ID", claims.UserID)
                r.Header.Set("X-Tenant-ID", claims.TenantID)
                
                next.ServeHTTP(w, r)
        })
}

func (s *TestServer) healthCheck(w http.ResponseWriter, r *http.Request) {
        status := map[string]interface{}{
                "status": "healthy",
                "time":   time.Now().UTC(),
                "server": "go-test",
        }

        w.Header().Set("Content-Type", "application/json")
        json.NewEncoder(w).Encode(status)
}

func (s *TestServer) createEmailTracking(w http.ResponseWriter, r *http.Request) {
        userID := r.Header.Get("X-User-ID")
        tenantID := r.Header.Get("X-Tenant-ID")

        var req struct {
                EmailID string `json:"emailId"`
                Status  string `json:"status"`
        }
        if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
                http.Error(w, "Invalid JSON payload", http.StatusBadRequest)
                return
        }

        if req.EmailID == "" || req.Status == "" {
                http.Error(w, "emailId and status are required", http.StatusBadRequest)
                return
        }

        entry := TestEmailTrackingEntry{
                ID:        fmt.Sprintf("%d", time.Now().UnixNano()),
                UserID:    userID,
                TenantID:  tenantID,
                EmailID:   req.EmailID,
                Status:    req.Status,
                Timestamp: time.Now().UTC(),
        }

        testEmailStore[entry.ID] = entry

        log.Printf("📧 Created email tracking entry: %s for user %s (status: %s)", entry.ID, userID, req.Status)

        w.Header().Set("Content-Type", "application/json")
        w.WriteHeader(http.StatusCreated)
        json.NewEncoder(w).Encode(entry)
}

func (s *TestServer) getEmailTrackings(w http.ResponseWriter, r *http.Request) {
        userID := r.Header.Get("X-User-ID")
        tenantID := r.Header.Get("X-Tenant-ID")

        var userEntries []TestEmailTrackingEntry
        for _, entry := range testEmailStore {
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