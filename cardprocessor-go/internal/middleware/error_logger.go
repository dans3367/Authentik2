package middleware

import (
	"fmt"
	"time"

	"github.com/gin-gonic/gin"
)

// ErrorLogger is a middleware that logs detailed information about HTTP errors
func ErrorLogger() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Process request
		startTime := time.Now()
		c.Next()

		// Check if there was an error or a 500 status
		statusCode := c.Writer.Status()

		if statusCode >= 500 {
			// Log detailed error information for 5xx errors
			duration := time.Since(startTime)

			fmt.Printf("\n╔═══════════════════════════════════════════════════════════════════════\n")
			fmt.Printf("║ 🚨 SERVER ERROR DETECTED - HTTP %d\n", statusCode)
			fmt.Printf("╠═══════════════════════════════════════════════════════════════════════\n")
			fmt.Printf("║ Timestamp:       %s\n", time.Now().Format("2006-01-02 15:04:05.000 MST"))
			fmt.Printf("║ Request ID:      %s\n", c.GetString("requestID"))
			fmt.Printf("║ Method:          %s\n", c.Request.Method)
			fmt.Printf("║ Path:            %s\n", c.Request.URL.Path)
			fmt.Printf("║ Full URL:        %s\n", c.Request.URL.String())
			fmt.Printf("║ Query String:    %s\n", c.Request.URL.RawQuery)
			fmt.Printf("║ Status Code:     %d\n", statusCode)
			fmt.Printf("║ Client IP:       %s\n", c.ClientIP())
			fmt.Printf("║ User Agent:      %s\n", c.Request.UserAgent())
			fmt.Printf("║ Referer:         %s\n", c.Request.Referer())
			fmt.Printf("║ Duration:        %v\n", duration)
			fmt.Printf("║ Content-Type:    %s\n", c.Request.Header.Get("Content-Type"))
			fmt.Printf("║ Content-Length:  %s\n", c.Request.Header.Get("Content-Length"))
			fmt.Printf("║ Accept:          %s\n", c.Request.Header.Get("Accept"))

			// Log user context if available
			if userID, exists := c.Get("userID"); exists {
				fmt.Printf("║ User ID:         %v\n", userID)
			}
			if tenantID, exists := c.Get("tenantID"); exists {
				fmt.Printf("║ Tenant ID:       %v\n", tenantID)
			}

			// Log errors from context if any
			if len(c.Errors) > 0 {
				fmt.Printf("║ Context Errors:\n")
				for i, err := range c.Errors {
					fmt.Printf("║   [%d] Type: %v, Error: %v\n", i+1, err.Type, err.Error())
				}
			}

			fmt.Printf("╚═══════════════════════════════════════════════════════════════════════\n\n")
		}
	}
}

// RequestLogger is a middleware that adds request ID and logs incoming requests
func RequestLogger() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Generate a simple request ID
		requestID := fmt.Sprintf("%d", time.Now().UnixNano())
		c.Set("requestID", requestID)

		// Log incoming request
		fmt.Printf("➡️  [%s] %s %s - IP: %s\n",
			requestID[:13],
			c.Request.Method,
			c.Request.URL.Path,
			c.ClientIP())

		c.Next()
	}
}
