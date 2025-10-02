package middleware

import (
	"cardprocessor-go/internal/config"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

// SetupCORS configures CORS middleware for the Gin router
func SetupCORS(cfg *config.Config) gin.HandlerFunc {
	corsConfig := cors.Config{
		AllowAllOrigins:  true, // Allow all origins for development
		AllowMethods:     cfg.CORS.AllowedMethods,
		AllowHeaders:     cfg.CORS.AllowedHeaders,
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: false, // Must be false when AllowAllOrigins is true
	}

	return cors.New(corsConfig)
}
