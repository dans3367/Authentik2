package router

import (
	"cardprocessor-go/internal/config"
	"cardprocessor-go/internal/handlers"
	"cardprocessor-go/internal/middleware"
	"cardprocessor-go/internal/repository"

	"github.com/gin-gonic/gin"
)

// SetupWebhookRouter configures a minimal Gin router for provider webhooks on a separate port
func SetupWebhookRouter(cfg *config.Config, repo *repository.Repository) *gin.Engine {
	// Set Gin mode based on GinMode config (respects GIN_MODE env var)
	gin.SetMode(cfg.GinMode)

	r := gin.New()
	r.Use(gin.Logger())
	r.Use(gin.Recovery())
	r.Use(middleware.ErrorLogger())

	h := handlers.NewWebhookHandler(repo, cfg)

	r.GET("/health", h.Health)

	// Resend webhook endpoint
	r.POST("/webhooks/resend", h.ResendWebhook)

	return r
}
