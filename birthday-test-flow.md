# Birthday Test Card Program Flow

## Overview
This document outlines the complete program flow when sending birthday test cards using the new card processor system.

## Architecture Components
- **Frontend**: React client (`client/src/pages/birthdays.tsx`)
- **Backend**: Go card processor (`cardprocessor-go/`)
- **Workflow Engine**: Temporal.io for orchestration
- **Email Providers**: Resend, SendGrid, Mailgun (fallback chain)

## Complete Program Flow

### 1. Frontend Initiation
**File**: `client/src/pages/birthdays.tsx` (lines 600-700)

```typescript
// User clicks "Send Test Birthday Card" button
const sendTestBirthdayMutation = useMutation({
  mutationFn: async (userId: string) => {
    // Prepare request payload with birthday settings
    const requestPayload = {
      userEmail: user.email,
      userFirstName: user.firstName,
      userLastName: user.lastName,
      emailTemplate: birthdaySettings?.emailTemplate,
      customMessage: birthdaySettings?.customMessage,
      customThemeData: birthdaySettings?.customThemeData,
      senderName: birthdaySettings?.senderName || ''
    };

    // Send POST request to card processor
    const response = await fetch(`${cardprocessorUrl}/api/birthday-test`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify(requestPayload),
    });
  }
});
```

### 2. API Route Handler
**File**: `cardprocessor-go/internal/router/router.go` (line 59)
- Route: `POST /api/birthday-test`
- Handler: `birthdayHandler.SendTestBirthdayCard`

### 3. Request Processing
**File**: `cardprocessor-go/internal/handlers/birthday.go` (lines 372-537)

#### 3.1 Authentication & Validation
```go
func (h *BirthdayHandler) SendTestBirthdayCard(c *gin.Context) {
    // Extract tenant ID and user ID from JWT token
    tenantID, err := middleware.GetTenantID(c)
    userID, err := middleware.GetUserID(c)
    
    // Parse and validate request body
    var req models.SendTestBirthdayCardRequest
    if err := c.ShouldBindJSON(&req); err != nil { ... }
    
    // Validate required fields
    if req.UserEmail == "" { ... }
}
```

#### 3.2 Data Preparation
```go
    // Convert custom theme data
    var customThemeData map[string]interface{}
    // ... theme data processing ...
    
    // Fetch birthday settings to get promotion ID
    birthdaySettings, err := h.repo.GetBirthdaySettings(context.Background(), tenantID)
    var promotionID string
    if birthdaySettings != nil && birthdaySettings.PromotionID != nil {
        promotionID = *birthdaySettings.PromotionID
    }
```

### 4. Temporal Workflow Decision
**File**: `cardprocessor-go/internal/handlers/birthday.go` (lines 476-523)

#### 4.1 Workflow Path (Preferred)
```go
if h.temporalClient != nil && h.temporalClient.IsConnected() {
    // Prepare workflow input
    workflowInput := temporal.BirthdayTestWorkflowInput{
        UserID:          userID,
        UserEmail:       req.UserEmail,
        UserFirstName:   req.UserFirstName,
        UserLastName:    req.UserLastName,
        TenantID:        tenantID,
        TenantName:      tenantName,
        FromEmail:       h.config.DefaultFromEmail,
        EmailTemplate:   req.EmailTemplate,
        CustomMessage:   req.CustomMessage,
        CustomThemeData: customThemeData,
        SenderName:      req.SenderName,
        PromotionID:     promotionID,
        IsTest:          true,
    }
    
    // Start the birthday test workflow
    workflowRun, err := h.temporalClient.StartBirthdayTestWorkflow(ctx, workflowInput)
    
    // Return workflow ID to client
    c.JSON(http.StatusOK, gin.H{
        "success":       true,
        "message":       "Birthday test workflow started successfully",
        "workflowId":    workflowRun.GetID(),
        "workflowRunId": workflowRun.GetRunID(),
    })
}
```

#### 4.2 Fallback Path
```go
// If Temporal client not available
c.JSON(http.StatusOK, gin.H{
    "success": true,
    "message": "Test birthday card sent successfully (direct mode)",
})
```

### 5. Temporal Workflow Execution
**File**: `cardprocessor-go/internal/temporal/workflows.go` (lines 64-152)

#### 5.1 Workflow Setup
```go
func BirthdayTestWorkflow(ctx workflow.Context, input BirthdayTestWorkflowInput) (BirthdayTestWorkflowResult, error) {
    // Set activity options with retry policy
    activityOptions := workflow.ActivityOptions{
        StartToCloseTimeout: 5 * time.Minute,
        HeartbeatTimeout:    1 * time.Minute,
        RetryPolicy: &temporal.RetryPolicy{
            InitialInterval:    1 * time.Second,
            MaximumInterval:    30 * time.Second,
            BackoffCoefficient: 2.0,
            MaximumAttempts:    3,
        },
    }
```

#### 5.2 Step 1: Fetch Promotion Data (Optional)
```go
    var promotion *models.Promotion
    if input.PromotionID != "" {
        err := workflow.ExecuteActivity(ctx, FetchPromotionData, FetchPromotionInput{
            PromotionID: input.PromotionID,
            TenantID:    input.TenantID,
        }).Get(ctx, &promotion)
        // Continue without promotion if fetch fails
    }
```

#### 5.3 Step 2: Prepare Email Content
```go
    var emailContent EmailContent
    err := workflow.ExecuteActivity(ctx, PrepareBirthdayTestEmailWithPromotion, PrepareBirthdayTestEmailInput{
        WorkflowInput: enrichedInput,
        Promotion:     promotion,
    }).Get(ctx, &emailContent)
```

#### 5.4 Step 3: Send Email
```go
    var sendResult EmailSendResult
    err = workflow.ExecuteActivity(ctx, SendBirthdayTestEmail, emailContent).Get(ctx, &sendResult)
```

#### 5.5 Step 4: Update Tracking Status
```go
    err = workflow.ExecuteActivity(ctx, UpdateBirthdayTestStatus, UpdateStatusInput{
        UserID:    input.UserID,
        TenantID:  input.TenantID,
        Success:   sendResult.Success,
        MessageID: sendResult.MessageID,
        Provider:  sendResult.Provider,
        Error:     sendResult.Error,
    }).Get(ctx, nil)
```

### 6. Email Content Preparation Activity
**File**: `cardprocessor-go/internal/temporal/activities.go` (lines 142-160)

```go
func PrepareBirthdayTestEmailWithPromotion(ctx context.Context, input PrepareBirthdayTestEmailInput) (EmailContent, error) {
    // Generate HTML content for birthday test card with promotion
    htmlContent := generateBirthdayTestHTMLWithPromotion(input.WorkflowInput, input.Promotion)
    
    // Generate text content (simplified version)
    textContent := fmt.Sprintf("Happy Birthday %s!\n\n%s\n\nBest regards,\n%s",
        input.WorkflowInput.UserFirstName, input.WorkflowInput.CustomMessage, input.WorkflowInput.SenderName)
    
    return EmailContent{
        Subject:     fmt.Sprintf("🎂 Happy Birthday %s!", input.WorkflowInput.UserFirstName),
        HTMLContent: htmlContent,
        TextContent: textContent,
        To:          input.WorkflowInput.UserEmail,
        From:        activityDeps.Config.DefaultFromEmail,
    }, nil
}
```

### 7. Email Sending Activity
**File**: `cardprocessor-go/internal/temporal/activities.go` (lines 184-204)

```go
func SendBirthdayTestEmail(ctx context.Context, content EmailContent) (EmailSendResult, error) {
    // Try different email providers in order of preference
    providers := []string{"resend", "sendgrid", "mailgun"}
    
    for _, provider := range providers {
        result, err := sendEmailViaProvider(ctx, provider, content)
        if err == nil && result.Success {
            return result, nil
        }
        // Log failure and try next provider
    }
    
    return EmailSendResult{
        Success: false,
        Error:   "All email providers failed",
    }, fmt.Errorf("all email providers failed")
}
```

### 8. Email Provider Implementation
**File**: `cardprocessor-go/internal/temporal/activities.go` (lines 294-351)

#### 8.1 Provider Selection
```go
func sendEmailViaProvider(ctx context.Context, provider string, content EmailContent) (EmailSendResult, error) {
    switch provider {
    case "resend":
        return sendViaResend(ctx, content)
    case "sendgrid":
        return sendViaSendGrid(ctx, content)
    case "mailgun":
        return sendViaMailgun(ctx, content)
    default:
        return EmailSendResult{Success: false, Error: "Unknown provider"}, fmt.Errorf("unknown provider: %s", provider)
    }
}
```

#### 8.2 Resend Implementation (Primary)
```go
func sendViaResend(ctx context.Context, content EmailContent) (EmailSendResult, error) {
    payload := map[string]interface{}{
        "from":    content.From,
        "to":      []string{content.To},
        "subject": content.Subject,
        "html":    content.HTMLContent,
        "text":    content.TextContent,
    }
    
    // Make HTTP request to Resend API
    req, err := http.NewRequestWithContext(ctx, "POST", "https://api.resend.com/emails", bytes.NewBuffer(jsonData))
    req.Header.Set("Authorization", "Bearer "+activityDeps.Config.ResendAPIKey)
    
    // Execute request and parse response
    client := &http.Client{Timeout: 30 * time.Second}
    resp, err := client.Do(req)
    
    return EmailSendResult{
        Success:   true,
        MessageID: result["id"].(string),
        Provider:  "resend",
    }, nil
}
```

### 9. HTML Template Generation
**File**: `cardprocessor-go/internal/temporal/activities.go` (lines 409-447)

```go
func generateBirthdayTestHTMLWithPromotion(input BirthdayTestWorkflowInput, promotion *models.Promotion) string {
    // Parse custom theme data
    customThemeData := ParseCustomThemeData(input.CustomThemeData)
    
    // Determine template type
    templateId := TemplateDefault
    switch strings.ToLower(input.EmailTemplate) {
    case "confetti":
        templateId = TemplateConfetti
    case "balloons":
        templateId = TemplateBalloons
    case "custom":
        templateId = TemplateCustom
    default:
        templateId = TemplateDefault
    }
    
    // Prepare template parameters with promotion data
    params := TemplateParams{
        RecipientName:   input.UserFirstName,
        Message:         input.CustomMessage,
        BrandName:       input.TenantName,
        CustomThemeData: customThemeData,
        SenderName:      input.SenderName,
        IsTest:          input.IsTest,
    }
    
    // Add promotion data if available
    if promotion != nil {
        params.PromotionContent = promotion.Content
        params.PromotionTitle = promotion.Title
        if promotion.Description != nil {
            params.PromotionDescription = *promotion.Description
        }
    }
    
    // Render the template
    return RenderBirthdayTemplate(templateId, params)
}
```

## Configuration Requirements

### Environment Variables
**File**: `cardprocessor-go/internal/config/config.go` (lines 120-139)

```go
// Email providers
SendGridAPIKey: getEnv("SENDGRID_API_KEY", ""),
MailgunAPIKey:  getEnv("MAILGUN_API_KEY", ""),
MailgunDomain:  getEnv("MAILGUN_DOMAIN", ""),
ResendAPIKey:   getEnv("RESEND_API_KEY", ""),

// Default email settings
DefaultFromEmail: getEnv("DEFAULT_FROM_EMAIL", "admin@zendwise.work"),
DefaultFromName:  getEnv("DEFAULT_FROM_NAME", "Authentik"),

// Temporal settings
TemporalAddress:       getEnv("TEMPORAL_ADDRESS", "localhost:7233"),
TemporalNamespace:     getEnv("TEMPORAL_NAMESPACE", "default"),
TemporalTaskQueue:     getEnv("TEMPORAL_TASK_QUEUE", "authentik-tasks"),
```

## Error Handling & Retry Logic

### Workflow Level
- **Retry Policy**: 3 attempts with exponential backoff (1s → 30s)
- **Timeout**: 5 minutes per activity
- **Heartbeat**: 1 minute intervals

### Provider Level
- **Fallback Chain**: Resend → SendGrid → Mailgun
- **Individual Provider Timeout**: 30 seconds
- **Graceful Degradation**: Continue without promotion if fetch fails

### Response Handling
- **Success**: Returns workflow ID and run ID
- **Failure**: Returns detailed error message
- **Fallback**: Direct mode if Temporal unavailable

## Data Flow Summary

1. **Frontend** → User interaction triggers test card request
2. **API Handler** → Validates request and extracts user/tenant info
3. **Temporal Client** → Starts workflow with prepared input
4. **Workflow** → Orchestrates activities in sequence
5. **Activities** → Execute specific tasks (fetch data, prepare email, send email, track status)
6. **Email Providers** → Attempt delivery with fallback chain
7. **Response** → Returns success/failure status to frontend

## Key Features

- **Asynchronous Processing**: Uses Temporal workflows for reliable execution
- **Multi-Provider Support**: Resend, SendGrid, Mailgun with automatic fallback
- **Template System**: Multiple birthday card templates (default, confetti, balloons, custom)
- **Promotion Integration**: Optional promotion data inclusion
- **Comprehensive Logging**: Detailed logging at each step
- **Error Recovery**: Retry policies and graceful degradation
- **Test Mode**: Special handling for test cards vs. production cards

