package temporal

import (
	"encoding/json"
	"fmt"
	"html/template"
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
	Accent    string `json:"accent"`
}

var themeColors = map[BirthdayTemplateId]ThemeColors{
	TemplateDefault:  {Primary: "#667eea", Secondary: "#764ba2", Accent: "#e91e63"},
	TemplateConfetti: {Primary: "#ff6b6b", Secondary: "#4ecdc4", Accent: "#45b7d1"},
	TemplateBalloons: {Primary: "#96ceb4", Secondary: "#feca57", Accent: "#ff9ff3"},
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

// renderCustomTemplate renders a custom birthday template
func renderCustomTemplate(params TemplateParams) string {
	customData := params.CustomThemeData

	// Check if it's the new structure (has themes property)
	if themes, ok := customData["themes"].(map[string]interface{}); ok {
		if custom, ok := themes["custom"].(map[string]interface{}); ok {
			customData = custom
		}
	}

	title := "Happy Birthday!"
	if recipientName, ok := customData["title"].(string); ok && recipientName != "" {
		title = recipientName
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
		fromMessage = params.BrandName
	}
	if fromMessage == "" {
		fromMessage = "The Team"
	}

	// Extract custom colors
	primaryColor := "#667eea"
	secondaryColor := "#764ba2"
	if colors, ok := customData["colors"].(map[string]interface{}); ok {
		if primary, ok := colors["primary"].(string); ok {
			primaryColor = primary
		}
		if secondary, ok := colors["secondary"].(string); ok {
			secondaryColor = secondary
		}
	}

	testBadge := ""
	if params.IsTest {
		testBadge = `<div style="position: absolute; top: 20px; right: 20px; background: #ff9800; color: white; padding: 8px 16px; border-radius: 20px; font-size: 12px; font-weight: bold;">TEST EMAIL</div>`
	}

	return fmt.Sprintf(`<html>
		<body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 20px; background: linear-gradient(135deg, %s 0%%, %s 100%%);">
			<div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.1); position: relative;">
				%s
				
				<!-- Header Image -->
				<div style="height: 200px; background: linear-gradient(135deg, %s 0%%, %s 100%%); background-size: cover; background-position: center; border-radius: 12px 12px 0 0; position: relative;">
					<div style="position: absolute; top: 50%%; left: 50%%; transform: translate(-50%%, -50%%); text-align: center; color: white;">
						<h1 style="font-size: 3rem; margin: 0; text-shadow: 2px 2px 4px rgba(0,0,0,0.3);">🎂</h1>
					</div>
				</div>
				
				<!-- Header Text -->
				<div style="padding: 30px 30px 20px 30px; text-align: center; border-bottom: 1px solid #f0f0f0;">
					<h1 style="color: #2d3748; font-size: 2.5rem; margin: 0; font-weight: bold;">%s</h1>
				</div>
				
				<!-- Content Area -->
				<div style="padding: 30px;">
					<div style="font-size: 1.2rem; line-height: 1.6; color: #4a5568; text-align: center; margin-bottom: 20px;">%s</div>
					%s
					%s
				</div>
				
				<!-- From Message -->
				<div style="padding: 20px 30px 30px 30px; border-top: 1px solid #e2e8f0; text-align: center;">
					<div style="font-size: 0.9rem; color: #718096;">
						<p style="margin: 0;">Best regards,</p>
						<p style="margin: 5px 0 0 0; font-weight: 600; color: #4a5568;">%s</p>
					</div>
				</div>
			</div>
		</body>
	</html>`,
		primaryColor, secondaryColor,
		testBadge,
		primaryColor, secondaryColor,
		template.HTMLEscapeString(title),
		template.HTMLEscapeString(message),
		renderPromotionContent(params),
		renderSignature(signature),
		template.HTMLEscapeString(fromMessage),
	)
}

// renderPredefinedTemplate renders predefined birthday templates
func renderPredefinedTemplate(templateId BirthdayTemplateId, params TemplateParams) string {
	colors := themeColors[templateId]
	if colors.Primary == "" {
		colors = themeColors[TemplateDefault]
	}

	recipientName := params.RecipientName
	if recipientName == "" {
		recipientName = "Friend"
	}

	message := params.Message
	if message == "" {
		message = "Wishing you a wonderful day!"
	}

	fromMessage := params.SenderName
	if fromMessage == "" {
		fromMessage = params.BrandName
	}
	if fromMessage == "" {
		fromMessage = "The Team"
	}

	// Template-specific content
	var headerImage, headline string
	switch templateId {
	case TemplateConfetti:
		headerImage = "https://images.unsplash.com/photo-1530103862676-de8c9debad1d?w=600&h=200&fit=crop"
		headline = fmt.Sprintf("🎉 Happy Birthday, %s!", recipientName)
	case TemplateBalloons:
		headerImage = "https://images.unsplash.com/photo-1464207687429-7505649dae38?w=600&h=200&fit=crop"
		headline = fmt.Sprintf("🎈 Happy Birthday, %s!", recipientName)
	default: // TemplateDefault
		headerImage = "https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?w=600&h=200&fit=crop"
		headline = fmt.Sprintf("🎂 Happy Birthday, %s!", recipientName)
	}

	testBadge := ""
	if params.IsTest {
		testBadge = `<div style="position: absolute; top: 20px; right: 20px; background: #ff9800; color: white; padding: 8px 16px; border-radius: 20px; font-size: 12px; font-weight: bold;">TEST EMAIL</div>`
	}

	return fmt.Sprintf(`<html>
		<body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 20px; background: linear-gradient(135deg, %s 0%%, %s 100%%);">
			<div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.1); position: relative;">
				%s
				
				<!-- Header Image -->
				<div style="height: 200px; background-image: url('%s'); background-size: cover; background-position: center; border-radius: 12px 12px 0 0;">
				</div>
				
				<!-- Header Text -->
				<div style="padding: 30px 30px 20px 30px; text-align: center; border-bottom: 1px solid #f0f0f0;">
					<h1 style="color: #2d3748; font-size: 2.5rem; margin: 0; font-weight: bold;">%s</h1>
				</div>
				
				<!-- Content Area -->
				<div style="padding: 30px;">
					<div style="font-size: 1.2rem; line-height: 1.6; color: #4a5568; text-align: center; margin-bottom: 20px;">%s</div>
					%s
					%s
				</div>
				
				<!-- From Message -->
				<div style="padding: 20px 30px 30px 30px; border-top: 1px solid #e2e8f0; text-align: center;">
					<div style="font-size: 0.9rem; color: #718096;">
						<p style="margin: 0;">Best regards,</p>
						<p style="margin: 5px 0 0 0; font-weight: 600; color: #4a5568;">%s</p>
					</div>
				</div>
			</div>
		</body>
	</html>`,
		colors.Primary, colors.Secondary,
		testBadge,
		headerImage,
		template.HTMLEscapeString(headline),
		template.HTMLEscapeString(message),
		renderPromotionContent(params),
		renderSignature(""),
		template.HTMLEscapeString(fromMessage),
	)
}

// renderPromotionContent renders promotion content if available
func renderPromotionContent(params TemplateParams) string {
	if params.PromotionContent == "" {
		return ""
	}

	promotionTitle := ""
	if params.PromotionTitle != "" {
		promotionTitle = fmt.Sprintf(`<h3 style="margin: 0 0 15px 0; color: #2d3748; font-size: 1.3rem; font-weight: 600;">%s</h3>`, template.HTMLEscapeString(params.PromotionTitle))
	}

	promotionDescription := ""
	if params.PromotionDescription != "" {
		promotionDescription = fmt.Sprintf(`<p style="margin: 0 0 15px 0; color: #4a5568; font-size: 1rem; line-height: 1.5;">%s</p>`, template.HTMLEscapeString(params.PromotionDescription))
	}

	return fmt.Sprintf(`
		<div style="margin: 30px 0; padding: 25px; background: linear-gradient(135deg, #f7fafc 0%%, #edf2f7 100%%); border-radius: 8px; border-left: 4px solid #667eea;">
			%s
			%s
			<div style="color: #2d3748; font-size: 1rem; line-height: 1.6;">%s</div>
		</div>`,
		promotionTitle,
		promotionDescription,
		template.HTMLEscapeString(params.PromotionContent),
	)
}

// renderSignature renders signature if available
func renderSignature(signature string) string {
	if signature == "" {
		return ""
	}
	return fmt.Sprintf(`<div style="font-size: 1rem; line-height: 1.5; color: #718096; text-align: center; font-style: italic; margin-top: 20px;">%s</div>`, template.HTMLEscapeString(signature))
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
