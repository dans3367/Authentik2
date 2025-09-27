package middleware

import (
	"context"
	"fmt"
	"net/http"
	"strings"

	"cardprocessor-go/internal/config"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

// JWTClaims represents the JWT token claims structure
type JWTClaims struct {
	UserID   string `json:"userId"`
	TenantID string `json:"tenantId"`
	jwt.RegisteredClaims
}

// AuthMiddleware provides JWT authentication middleware
type AuthMiddleware struct {
	jwtSecret string
}

// NewAuthMiddleware creates a new authentication middleware instance
func NewAuthMiddleware(cfg *config.Config) *AuthMiddleware {
	return &AuthMiddleware{
		jwtSecret: cfg.JWT.Secret,
	}
}

// RequireAuth is a Gin middleware that validates JWT tokens
func (am *AuthMiddleware) RequireAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, gin.H{
				"success": false,
				"error":   "Authorization header required",
			})
			c.Abort()
			return
		}

		tokenString := strings.TrimPrefix(authHeader, "Bearer ")
		if tokenString == authHeader {
			c.JSON(http.StatusUnauthorized, gin.H{
				"success": false,
				"error":   "Bearer token required",
			})
			c.Abort()
			return
		}

		token, err := jwt.ParseWithClaims(tokenString, &JWTClaims{}, func(token *jwt.Token) (interface{}, error) {
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
			}
			return []byte(am.jwtSecret), nil
		})

		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{
				"success": false,
				"error":   "Invalid token",
			})
			c.Abort()
			return
		}

		claims, ok := token.Claims.(*JWTClaims)
		if !ok || !token.Valid {
			c.JSON(http.StatusUnauthorized, gin.H{
				"success": false,
				"error":   "Invalid token claims",
			})
			c.Abort()
			return
		}

		// Add user info to context
		c.Set("userID", claims.UserID)
		c.Set("tenantID", claims.TenantID)

		c.Next()
	}
}

// GetUserID extracts the user ID from the Gin context
func GetUserID(c *gin.Context) (string, error) {
	userID, exists := c.Get("userID")
	if !exists {
		return "", fmt.Errorf("user ID not found in context")
	}

	userIDStr, ok := userID.(string)
	if !ok {
		return "", fmt.Errorf("user ID is not a string")
	}

	return userIDStr, nil
}

// GetTenantID extracts the tenant ID from the Gin context
func GetTenantID(c *gin.Context) (string, error) {
	tenantID, exists := c.Get("tenantID")
	if !exists {
		return "", fmt.Errorf("tenant ID not found in context")
	}

	tenantIDStr, ok := tenantID.(string)
	if !ok {
		return "", fmt.Errorf("tenant ID is not a string")
	}

	return tenantIDStr, nil
}

// GetUserContext extracts both user ID and tenant ID from the Gin context
func GetUserContext(c *gin.Context) (userID, tenantID string, err error) {
	userID, err = GetUserID(c)
	if err != nil {
		return "", "", err
	}

	tenantID, err = GetTenantID(c)
	if err != nil {
		return "", "", err
	}

	return userID, tenantID, nil
}

// RequireTenant is a middleware that ensures the user belongs to a specific tenant
func (am *AuthMiddleware) RequireTenant(requiredTenantID string) gin.HandlerFunc {
	return func(c *gin.Context) {
		tenantID, err := GetTenantID(c)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{
				"success": false,
				"error":   "Tenant ID not found",
			})
			c.Abort()
			return
		}

		if tenantID != requiredTenantID {
			c.JSON(http.StatusForbidden, gin.H{
				"success": false,
				"error":   "Access denied for this tenant",
			})
			c.Abort()
			return
		}

		c.Next()
	}
}

// ValidateJWTToken validates a JWT token and returns the claims
func (am *AuthMiddleware) ValidateJWTToken(tokenString string) (*JWTClaims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &JWTClaims{}, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return []byte(am.jwtSecret), nil
	})

	if err != nil {
		return nil, fmt.Errorf("failed to parse token: %w", err)
	}

	claims, ok := token.Claims.(*JWTClaims)
	if !ok || !token.Valid {
		return nil, fmt.Errorf("invalid token claims")
	}

	return claims, nil
}

// CreateContextWithAuth creates a context with authentication information
func CreateContextWithAuth(ctx context.Context, userID, tenantID string) context.Context {
	ctx = context.WithValue(ctx, "userID", userID)
	ctx = context.WithValue(ctx, "tenantID", tenantID)
	return ctx
}

// GetUserIDFromContext extracts user ID from context
func GetUserIDFromContext(ctx context.Context) (string, error) {
	userID, ok := ctx.Value("userID").(string)
	if !ok {
		return "", fmt.Errorf("user ID not found in context")
	}
	return userID, nil
}

// GetTenantIDFromContext extracts tenant ID from context
func GetTenantIDFromContext(ctx context.Context) (string, error) {
	tenantID, ok := ctx.Value("tenantID").(string)
	if !ok {
		return "", fmt.Errorf("tenant ID not found in context")
	}
	return tenantID, nil
}
