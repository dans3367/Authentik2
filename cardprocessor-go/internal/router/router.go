package router

import (
	"cardprocessor-go/internal/config"
	"cardprocessor-go/internal/handlers"
	"cardprocessor-go/internal/middleware"
	"cardprocessor-go/internal/repository"
	"cardprocessor-go/internal/temporal"

	"github.com/gin-gonic/gin"
)

// SetupRouter configures and returns the Gin router with all routes
func SetupRouter(cfg *config.Config, repo *repository.Repository, temporalClient *temporal.TemporalClient) *gin.Engine {
	// Set Gin mode based on environment
	if cfg.Server.Environment == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	router := gin.New()

	// Add middleware
	router.Use(gin.Logger())
	router.Use(gin.Recovery())
	router.Use(middleware.SetupCORS(cfg))

	// Create handlers
	birthdayHandler := handlers.NewBirthdayHandler(repo, temporalClient, cfg)
	authMiddleware := middleware.NewAuthMiddleware(cfg)

	// Health check endpoint (no auth required)
	router.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"status":  "ok",
			"service": "birthday-card-processor",
			"version": "1.0.0",
		})
	})

	// API routes with authentication
	api := router.Group("/api")
	api.Use(authMiddleware.RequireAuth())
	{
		// Birthday settings endpoints
		api.GET("/birthday-settings", birthdayHandler.GetBirthdaySettings)
		api.PUT("/birthday-settings", birthdayHandler.UpdateBirthdaySettings)

		// Birthday contacts endpoints
		api.GET("/birthday-contacts", birthdayHandler.GetBirthdayContacts)

		// Contact birthday management
		api.PUT("/email-contacts/:contactId", birthdayHandler.UpdateContactBirthday)
		api.PATCH("/email-contacts/birthday-email/bulk", birthdayHandler.UpdateBulkBirthdayEmailPreference)

		// Birthday invitation endpoints
		api.POST("/birthday-invitation/:contactId", birthdayHandler.SendBirthdayInvitation)

		// Test birthday card endpoint
		api.POST("/birthday-test", birthdayHandler.SendTestBirthdayCard)
	}

	return router
}
