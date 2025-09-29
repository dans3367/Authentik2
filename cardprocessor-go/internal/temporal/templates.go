package temporal

import (
	"encoding/json"
	"fmt"
	"html/template"
	"regexp"
	"strings"
)

// BirthdayTemplateId represents the different template types
type BirthdayTemplateId string

const (
	TemplateDefault  BirthdayTemplateId = "default"
	TemplateConfetti BirthdayTemplateId = "confetti"
	TemplateBalloons BirthdayTemplateId = "balloons"
	TemplateCustom   BirthdayTemplateId = "custom"
)

// TemplateParams represents the parameters for birthday template rendering
type TemplateParams struct {
	RecipientName        string                 `json:"recipientName"`
	Message              string                 `json:"message"`
	ImageUrl             string                 `json:"imageUrl"`
	BrandName            string                 `json:"brandName"`
	CustomThemeData      map[string]interface{} `json:"customThemeData"`
	SenderName           string                 `json:"senderName"`
	PromotionContent     string                 `json:"promotionContent"`
	PromotionTitle       string                 `json:"promotionTitle"`
	PromotionDescription string                 `json:"promotionDescription"`
	IsTest               bool                   `json:"isTest"`
}

// ThemeColors represents color schemes for different templates
type ThemeColors struct {
	Primary   string `json:"primary"`
	Secondary string `json:"secondary"`
}

// ThemeHeaders represents header images for different templates
var themeHeaders = map[BirthdayTemplateId]string{
	TemplateDefault:  "https://images.unsplash.com/photo-1588195538326-c5b1e9f80a1b?q=80&w=2550&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
	TemplateConfetti: "https://images.unsplash.com/photo-1530103862676-de8c9debad1d?q=80&w=2550&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
	TemplateBalloons: "https://images.unsplash.com/photo-1464349095431-e9a21285b5f3?q=80&w=2550&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
}

var themeColors = map[BirthdayTemplateId]ThemeColors{
	TemplateDefault:  {Primary: "#667eea", Secondary: "#764ba2"},
	TemplateConfetti: {Primary: "#ff6b6b", Secondary: "#feca57"},
	TemplateBalloons: {Primary: "#54a0ff", Secondary: "#5f27cd"},
}

// RenderBirthdayTemplate renders a birthday card template based on the template type and parameters
func RenderBirthdayTemplate(templateId BirthdayTemplateId, params TemplateParams) string {
	fmt.Printf("🎂 [RenderBirthdayTemplate] Called with template: %s\n", templateId)

	// Handle custom theme with rich styling
	if templateId == TemplateCustom && params.CustomThemeData != nil {
		return renderCustomTemplate(params)
	}

	// Handle predefined templates
	return renderPredefinedTemplate(templateId, params)
}

// renderCustomTemplate renders a custom birthday template exactly matching server-node
func renderCustomTemplate(params TemplateParams) string {
	customData := params.CustomThemeData
	if customData == nil {
		return `<html><body><p>No custom theme data found</p></body></html>`
	}

	// Check if it's the new structure (has themes property)
	if themes, ok := customData["themes"].(map[string]interface{}); ok {
		if custom, ok := themes["custom"].(map[string]interface{}); ok {
			customData = custom
		}
	}

	title := "Happy Birthday!"
	if customTitle, ok := customData["title"].(string); ok && customTitle != "" {
		title = customTitle
	} else if params.RecipientName != "" {
		title = fmt.Sprintf("Happy Birthday, %s!", params.RecipientName)
	}

	message := params.Message
	if customMessage, ok := customData["message"].(string); ok && customMessage != "" {
		message = customMessage
	}
	if message == "" {
		message = "Wishing you a wonderful day!"
	}

	signature := ""
	if customSignature, ok := customData["signature"].(string); ok {
		signature = customSignature
	}

	fromMessage := params.SenderName
	if fromMessage == "" {
		fromMessage = "The Team"
	}

	// Header image section - exactly matching server-node logic
	headerImageSection := ""
	if imageUrl, ok := customData["imageUrl"].(string); ok && imageUrl != "" {
		headerImageSection = fmt.Sprintf(`
			<div style="height: 200px; background-image: url('%s'); background-size: cover; background-position: center; border-radius: 12px 12px 0 0;">
			</div>`, imageUrl)
	} else {
		headerImageSection = `
			<div style="background: linear-gradient(135deg, #a8e6cf 0%, #dcedc1 100%); height: 200px; border-radius: 12px 12px 0 0;">
			</div>`
	}

	// Conditionally render fromMessage section only if no signature
	fromMessageSection := ""
	if signature == "" {
		fromMessageSection = fmt.Sprintf(`
				<!-- 4. From Message -->
				<div style="padding: 20px 30px 30px 30px; border-top: 1px solid #e2e8f0; text-align: center;">
					<div style="font-size: 0.9rem; color: #718096;">
						<p style="margin: 0; font-weight: 600; color: #4a5568;">%s</p>
					</div>
				</div>`, template.HTMLEscapeString(fromMessage))
	}

	return fmt.Sprintf(`<html>
		<body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 20px; background: linear-gradient(135deg, #667eea 0%%, #764ba2 100%%);">
			<div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.1);">
				
				<!-- 1. Header Image (standalone) -->
				%s
				
				<!-- 2. Header Text (separate from image) -->
				<div style="padding: 30px 30px 20px 30px; text-align: center; border-bottom: 1px solid #f0f0f0;">
					<h1 style="color: #2d3748; font-size: 2.5rem; margin: 0; font-weight: bold;">%s</h1>
				</div>
				
				<!-- 3. Content Area (message) -->
				<div style="padding: 30px;">
					<div style="font-size: 1.2rem; line-height: 1.6; color: #4a5568; text-align: center; margin-bottom: 20px;">%s</div>
					%s
					%s
				</div>
				
				%s
			</div>
		</body>
	</html>`,
		headerImageSection,
		template.HTMLEscapeString(title),
		sanitizeHTMLContent(message, params),
		renderPromotionContent(params),
		renderSignature(signature, params),
		fromMessageSection,
	)
}

// renderPredefinedTemplate renders predefined birthday templates exactly matching server-node
func renderPredefinedTemplate(templateId BirthdayTemplateId, params TemplateParams) string {
	colors := themeColors[templateId]
	if colors.Primary == "" {
		colors = themeColors[TemplateDefault]
	}

	headerImage := themeHeaders[templateId]
	if headerImage == "" {
		headerImage = themeHeaders[TemplateDefault]
	}

	// Check if there's custom theme data with custom title/signature for this specific theme
	headline := fmt.Sprintf("Happy Birthday%s!", func() string {
		if params.RecipientName != "" {
			return ", " + params.RecipientName
		}
		return ""
	}())
	signature := ""

	if params.CustomThemeData != nil {
		var themeSpecificData map[string]interface{}

		// Check if it's the new structure (has themes property)
		if themes, ok := params.CustomThemeData["themes"].(map[string]interface{}); ok {
			if themeData, ok := themes[string(templateId)].(map[string]interface{}); ok {
				themeSpecificData = themeData
			}
		} else {
			// Old structure - use directly if no themes property
			themeSpecificData = params.CustomThemeData
		}

		if themeSpecificData != nil {
			// Use custom title if provided, otherwise use default
			if customTitle, ok := themeSpecificData["title"].(string); ok && customTitle != "" {
				headline = customTitle
			}

			// Use custom signature if provided
			if customSignature, ok := themeSpecificData["signature"].(string); ok {
				signature = customSignature
			}
		}
	}

	message := params.Message
	if message == "" {
		message = "Wishing you a wonderful day!"
	}

	fromMessage := params.SenderName
	if fromMessage == "" {
		fromMessage = "The Team"
	}

	// Conditionally render fromMessage section only if no signature
	fromMessageSection := ""
	if signature == "" {
		fromMessageSection = fmt.Sprintf(`
				<!-- 4. From Message -->
				<div style="padding: 20px 30px 30px 30px; border-top: 1px solid #e2e8f0; text-align: center;">
					<div style="font-size: 0.9rem; color: #718096;">
						<p style="margin: 0; font-weight: 600; color: #4a5568;">%s</p>
					</div>
				</div>`, template.HTMLEscapeString(fromMessage))
	}

	return fmt.Sprintf(`<html>
		<body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 20px; background: linear-gradient(135deg, %s 0%%, %s 100%%);">
			<div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.1);">
				
				<!-- 1. Header Image (standalone) -->
				<div style="height: 200px; background-image: url('%s'); background-size: cover; background-position: center; border-radius: 12px 12px 0 0;">
				</div>
				
				<!-- 2. Header Text (separate from image) -->
				<div style="padding: 30px 30px 20px 30px; text-align: center; border-bottom: 1px solid #f0f0f0;">
					<h1 style="color: #2d3748; font-size: 2.5rem; margin: 0; font-weight: bold;">%s</h1>
				</div>
				
				<!-- 3. Content Area (message) -->
				<div style="padding: 30px;">
					<div style="font-size: 1.2rem; line-height: 1.6; color: #4a5568; text-align: center; margin-bottom: 20px;">%s</div>
					%s
					%s
				</div>
				
				%s
			</div>
		</body>
	</html>`,
		colors.Primary, colors.Secondary,
		headerImage,
		template.HTMLEscapeString(headline),
		sanitizeHTMLContent(message, params),
		renderPromotionContent(params),
		renderSignature(signature, params),
		fromMessageSection,
	)
}

// renderPromotionContent renders promotion content if available
func renderPromotionContent(params TemplateParams) string {
	if params.PromotionContent == "" {
		return ""
	}

	promotionTitle := ""
	if params.PromotionTitle != "" {
		promotionTitle = fmt.Sprintf(`<h3 style="margin: 0 0 15px 0; color: #2d3748; font-size: 1.3rem; font-weight: 600;">%s</h3>`, sanitizeHTMLContent(params.PromotionTitle, params))
	}

	promotionDescription := ""
	if params.PromotionDescription != "" {
		promotionDescription = fmt.Sprintf(`<p style="margin: 0 0 15px 0; color: #4a5568; font-size: 1rem; line-height: 1.5;">%s</p>`, sanitizeHTMLContent(params.PromotionDescription, params))
	}

	return fmt.Sprintf(`
		<div style="margin: 30px 0; padding: 25px; background: linear-gradient(135deg, #f7fafc 0%%, #edf2f7 100%%); border-radius: 8px; border-left: 4px solid #667eea;">
			%s
			%s
			<div style="color: #2d3748; font-size: 1rem; line-height: 1.6;">%s</div>
		</div>`,
		promotionTitle,
		promotionDescription,
		sanitizeHTMLContent(params.PromotionContent, params),
	)
}

// renderSignature renders signature if available
func renderSignature(signature string, params TemplateParams) string {
	if signature == "" {
		return ""
	}
	return fmt.Sprintf(`<div style="font-size: 1rem; line-height: 1.5; color: #718096; text-align: center; font-style: italic; margin-top: 20px;">%s</div>`, sanitizeHTMLContent(signature, params))
}

// processPlaceholders replaces placeholder tokens with actual customer data
func processPlaceholders(content string, params TemplateParams) string {
	if content == "" {
		return content
	}

	// Extract first and last name from recipientName
	firstName := ""
	lastName := ""
	if params.RecipientName != "" {
		nameParts := strings.Fields(params.RecipientName)
		if len(nameParts) > 0 {
			firstName = nameParts[0]
		}
		if len(nameParts) > 1 {
			lastName = strings.Join(nameParts[1:], " ")
		}
	}

	// Replace placeholders
	content = strings.ReplaceAll(content, "{{firstName}}", firstName)
	content = strings.ReplaceAll(content, "{{lastName}}", lastName)

	return content
}

// sanitizeHTMLContent safely renders HTML content by allowing only safe HTML tags and processes placeholders
func sanitizeHTMLContent(content string, params TemplateParams) string {
	if content == "" {
		return ""
	}

	// First process placeholders
	content = processPlaceholders(content, params)

	// Allow common safe HTML tags for formatting
	allowedTags := []string{
		"p", "br", "strong", "b", "em", "i", "u", "span", "div",
		"h1", "h2", "h3", "h4", "h5", "h6",
	}

	// Allow common safe style attributes (for future use)
	_ = []string{
		"color", "font-weight", "font-style", "text-decoration",
		"font-size", "text-align", "margin", "padding",
	}

	// Basic HTML content - if it contains HTML tags, render as-is (assuming it's safe)
	// This is a simplified approach - in production, you might want to use a proper HTML sanitizer
	if strings.Contains(content, "<") && strings.Contains(content, ">") {
		// Simple validation - check if it contains only allowed tags
		for _, tag := range allowedTags {
			// Replace common patterns to ensure they're properly formatted
			content = regexp.MustCompile(`<`+tag+`\s*>`).ReplaceAllString(content, `<`+tag+`>`)
			content = regexp.MustCompile(`</`+tag+`\s*>`).ReplaceAllString(content, `</`+tag+`>`)
		}
		return content
	}

	// If no HTML tags, escape the content for safety
	return template.HTMLEscapeString(content)
}

// ParseCustomThemeData parses custom theme data from various formats
func ParseCustomThemeData(customThemeData interface{}) map[string]interface{} {
	if customThemeData == nil {
		return nil
	}

	switch v := customThemeData.(type) {
	case map[string]interface{}:
		return v
	case string:
		if v == "null" || v == "" {
			return nil
		}
		// Try to parse as JSON
		var parsed map[string]interface{}
		if err := json.Unmarshal([]byte(v), &parsed); err != nil {
			fmt.Printf("⚠️ Failed to parse CustomThemeData as JSON: %v\n", err)
			return nil
		}
		return parsed
	default:
		fmt.Printf("⚠️ Unexpected CustomThemeData type: %T\n", v)
		return nil
	}
}
