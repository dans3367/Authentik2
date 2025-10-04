package repository

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
	"time"

	"cardprocessor-go/internal/database"
	"cardprocessor-go/internal/models"

	"github.com/google/uuid"
)

// Repository handles database operations
type Repository struct {
	db *database.DB
}

// NewRepository creates a new repository instance
func NewRepository(db *database.DB) *Repository {
	return &Repository{db: db}
}

// GetBirthdaySettings retrieves birthday settings for a tenant
func (r *Repository) GetBirthdaySettings(ctx context.Context, tenantID string) (*models.BirthdaySettings, error) {
	query := `
		SELECT id, tenant_id, enabled, email_template, segment_filter, 
		       custom_message, custom_theme_data, sender_name, promotion_id,
		       split_promotional_email, created_at, updated_at
		FROM birthday_settings 
		WHERE tenant_id = $1
	`

	var settings models.BirthdaySettings
	err := r.db.QueryRowContext(ctx, query, tenantID).Scan(
		&settings.ID,
		&settings.TenantID,
		&settings.Enabled,
		&settings.EmailTemplate,
		&settings.SegmentFilter,
		&settings.CustomMessage,
		&settings.CustomThemeData,
		&settings.SenderName,
		&settings.PromotionID,
		&settings.SplitPromotionalEmail,
		&settings.CreatedAt,
		&settings.UpdatedAt,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil // No settings found
		}
		return nil, fmt.Errorf("failed to get birthday settings: %w", err)
	}

	return &settings, nil
}

// CreateBirthdaySettings creates new birthday settings for a tenant
func (r *Repository) CreateBirthdaySettings(tenantID string, req *models.CreateBirthdaySettingsRequest) (*models.BirthdaySettings, error) {
	id := uuid.New().String()
	now := time.Now()

	query := `
		INSERT INTO birthday_settings (
			id, tenant_id, enabled, email_template, segment_filter,
			custom_message, custom_theme_data, sender_name, promotion_id,
			created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
		RETURNING id, tenant_id, enabled, email_template, segment_filter,
		          custom_message, custom_theme_data, sender_name, promotion_id,
		          created_at, updated_at
	`

	var settings models.BirthdaySettings
	err := r.db.QueryRow(query,
		id, tenantID, req.Enabled, req.EmailTemplate, req.SegmentFilter,
		req.CustomMessage, req.CustomThemeData, req.SenderName, req.PromotionID,
		now, now,
	).Scan(
		&settings.ID,
		&settings.TenantID,
		&settings.Enabled,
		&settings.EmailTemplate,
		&settings.SegmentFilter,
		&settings.CustomMessage,
		&settings.CustomThemeData,
		&settings.SenderName,
		&settings.PromotionID,
		&settings.SplitPromotionalEmail,
		&settings.CreatedAt,
		&settings.UpdatedAt,
	)

	if err != nil {
		return nil, fmt.Errorf("failed to create birthday settings: %w", err)
	}

	return &settings, nil
}

// UpdateBirthdaySettings updates existing birthday settings
func (r *Repository) UpdateBirthdaySettings(ctx context.Context, settings *models.BirthdaySettings) (*models.BirthdaySettings, error) {
	// Check if settings exist, if not create them
	existingSettings, err := r.GetBirthdaySettings(ctx, settings.TenantID)
	if err != nil {
		return nil, fmt.Errorf("failed to check existing settings: %w", err)
	}

	if existingSettings == nil {
		// Create new settings
		req := &models.CreateBirthdaySettingsRequest{
			Enabled:         settings.Enabled,
			EmailTemplate:   settings.EmailTemplate,
			SegmentFilter:   settings.SegmentFilter,
			CustomMessage:   settings.CustomMessage,
			CustomThemeData: settings.CustomThemeData,
			SenderName:      settings.SenderName,
			PromotionID:     settings.PromotionID,
		}
		return r.CreateBirthdaySettings(settings.TenantID, req)
	}

	// Update existing settings
	query := `
		UPDATE birthday_settings 
		SET enabled = $1, email_template = $2, segment_filter = $3,
		    custom_message = $4, custom_theme_data = $5, sender_name = $6,
		    promotion_id = $7, updated_at = $8
		WHERE tenant_id = $9
		RETURNING id, tenant_id, enabled, email_template, segment_filter,
		          custom_message, custom_theme_data, sender_name, promotion_id,
		          created_at, updated_at
	`

	var updatedSettings models.BirthdaySettings
	err = r.db.QueryRowContext(ctx, query,
		settings.Enabled, settings.EmailTemplate, settings.SegmentFilter,
		settings.CustomMessage, settings.CustomThemeData, settings.SenderName,
		settings.PromotionID, time.Now(), settings.TenantID,
	).Scan(
		&updatedSettings.ID,
		&updatedSettings.TenantID,
		&updatedSettings.Enabled,
		&updatedSettings.EmailTemplate,
		&updatedSettings.SegmentFilter,
		&updatedSettings.CustomMessage,
		&updatedSettings.CustomThemeData,
		&updatedSettings.SenderName,
		&updatedSettings.PromotionID,
		&updatedSettings.CreatedAt,
		&updatedSettings.UpdatedAt,
	)

	if err != nil {
		return nil, fmt.Errorf("failed to update birthday settings: %w", err)
	}

	return &updatedSettings, nil
}

// GetContactsWithBirthdays retrieves contacts with birthdays for a specific date
func (r *Repository) GetContactsWithBirthdays(tenantID string, date time.Time) ([]*models.EmailContact, error) {
	// Format date as MM-DD to match birthday field format
	birthdayFilter := date.Format("01-02")

	query := `
		SELECT id, tenant_id, email, first_name, last_name, status,
		       added_date, last_activity, emails_sent, emails_opened,
		       birthday, birthday_email_enabled, consent_given, consent_date,
		       consent_method, consent_ip_address, consent_user_agent,
		       added_by_user_id, created_at, updated_at
		FROM email_contacts 
		WHERE tenant_id = $1 
		  AND birthday_email_enabled = true 
		  AND status = 'active'
		  AND RIGHT(birthday, 5) = $2
		  AND birthday IS NOT NULL
	`

	rows, err := r.db.Query(query, tenantID, birthdayFilter)
	if err != nil {
		return nil, fmt.Errorf("failed to get contacts with birthdays: %w", err)
	}
	defer rows.Close()

	var contacts []*models.EmailContact
	for rows.Next() {
		var contact models.EmailContact
		err := rows.Scan(
			&contact.ID,
			&contact.TenantID,
			&contact.Email,
			&contact.FirstName,
			&contact.LastName,
			&contact.Status,
			&contact.AddedDate,
			&contact.LastActivity,
			&contact.EmailsSent,
			&contact.EmailsOpened,
			&contact.Birthday,
			&contact.BirthdayEmailEnabled,
			&contact.ConsentGiven,
			&contact.ConsentDate,
			&contact.ConsentMethod,
			&contact.ConsentIPAddress,
			&contact.ConsentUserAgent,
			&contact.AddedByUserID,
			&contact.CreatedAt,
			&contact.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan contact: %w", err)
		}
		contacts = append(contacts, &contact)
	}

	return contacts, nil
}

// GetContactsWithBirthday retrieves contacts with birthdays for a specific date
func (r *Repository) GetContactsWithBirthday(ctx context.Context, tenantID string, date time.Time) ([]models.EmailContact, error) {
	dateStr := date.Format("2006-01-02")

	query := `
		SELECT id, tenant_id, email, first_name, last_name, status, added_date, 
		       last_activity, emails_sent, emails_opened, birthday, birthday_email_enabled
		FROM email_contacts 
		WHERE tenant_id = $1 AND birthday = $2 AND birthday_email_enabled = true 
		      AND birthday_unsubscribed_at IS NULL
		ORDER BY first_name, last_name
	`

	rows, err := r.db.QueryContext(ctx, query, tenantID, dateStr)
	if err != nil {
		return nil, fmt.Errorf("failed to query contacts with birthday: %w", err)
	}
	defer rows.Close()

	var contacts []models.EmailContact
	for rows.Next() {
		var contact models.EmailContact
		err := rows.Scan(
			&contact.ID, &contact.TenantID, &contact.Email, &contact.FirstName, &contact.LastName,
			&contact.Status, &contact.AddedDate, &contact.LastActivity, &contact.EmailsSent,
			&contact.EmailsOpened, &contact.Birthday, &contact.BirthdayEmailEnabled,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan contact: %w", err)
		}
		contacts = append(contacts, contact)
	}

	return contacts, nil
}

// GetBirthdayContacts retrieves all contacts with birthdays for a tenant
func (r *Repository) GetBirthdayContacts(ctx context.Context, tenantID string, limit, offset int) ([]models.EmailContact, int64, error) {
	// Get total count
	countQuery := `SELECT COUNT(*) FROM email_contacts WHERE tenant_id = $1 AND birthday IS NOT NULL`
	var total int64
	err := r.db.QueryRowContext(ctx, countQuery, tenantID).Scan(&total)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to count birthday contacts: %w", err)
	}

	// Get contacts
	query := `
		SELECT id, tenant_id, email, first_name, last_name, status, added_date, 
		       last_activity, emails_sent, emails_opened, birthday, birthday_email_enabled
		FROM email_contacts 
		WHERE tenant_id = $1 AND birthday IS NOT NULL
		ORDER BY birthday, first_name, last_name
		LIMIT $2 OFFSET $3
	`

	rows, err := r.db.QueryContext(ctx, query, tenantID, limit, offset)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to query birthday contacts: %w", err)
	}
	defer rows.Close()

	var contacts []models.EmailContact
	for rows.Next() {
		var contact models.EmailContact
		err := rows.Scan(
			&contact.ID, &contact.TenantID, &contact.Email, &contact.FirstName, &contact.LastName,
			&contact.Status, &contact.AddedDate, &contact.LastActivity, &contact.EmailsSent,
			&contact.EmailsOpened, &contact.Birthday, &contact.BirthdayEmailEnabled,
		)
		if err != nil {
			return nil, 0, fmt.Errorf("failed to scan contact: %w", err)
		}
		contacts = append(contacts, contact)
	}

	return contacts, total, nil
}

// GetUpcomingBirthdayContacts retrieves contacts with birthdays in the next 30 days
func (r *Repository) GetUpcomingBirthdayContacts(ctx context.Context, tenantID string, limit, offset int) ([]models.EmailContact, int64, error) {
	// For upcoming birthdays, we need to handle year-agnostic matching
	// This is a simplified approach - in production you might want more sophisticated logic
	today := time.Now()
	thirtyDaysFromNow := today.AddDate(0, 0, 30)

	// Get total count
	countQuery := `
		SELECT COUNT(*) FROM email_contacts 
		WHERE tenant_id = $1 AND birthday IS NOT NULL AND birthday_unsubscribed_at IS NULL
		AND (
			(EXTRACT(MONTH FROM birthday::date) = EXTRACT(MONTH FROM $2::date) AND EXTRACT(DAY FROM birthday::date) >= EXTRACT(DAY FROM $2::date))
			OR (EXTRACT(MONTH FROM birthday::date) = EXTRACT(MONTH FROM $3::date) AND EXTRACT(DAY FROM birthday::date) <= EXTRACT(DAY FROM $3::date))
			OR (EXTRACT(MONTH FROM birthday::date) > EXTRACT(MONTH FROM $2::date) AND EXTRACT(MONTH FROM birthday::date) < EXTRACT(MONTH FROM $3::date))
		)
	`
	var total int64
	err := r.db.QueryRowContext(ctx, countQuery, tenantID, today.Format("2006-01-02"), thirtyDaysFromNow.Format("2006-01-02")).Scan(&total)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to count upcoming birthday contacts: %w", err)
	}

	// Get contacts
	query := `
		SELECT id, tenant_id, email, first_name, last_name, status, added_date, 
		       last_activity, emails_sent, emails_opened, birthday, birthday_email_enabled
		FROM email_contacts 
		WHERE tenant_id = $1 AND birthday IS NOT NULL AND birthday_unsubscribed_at IS NULL
		AND (
			(EXTRACT(MONTH FROM birthday::date) = EXTRACT(MONTH FROM $2::date) AND EXTRACT(DAY FROM birthday::date) >= EXTRACT(DAY FROM $2::date))
			OR (EXTRACT(MONTH FROM birthday::date) = EXTRACT(MONTH FROM $3::date) AND EXTRACT(DAY FROM birthday::date) <= EXTRACT(DAY FROM $3::date))
			OR (EXTRACT(MONTH FROM birthday::date) > EXTRACT(MONTH FROM $2::date) AND EXTRACT(MONTH FROM birthday::date) < EXTRACT(MONTH FROM $3::date))
		)
		ORDER BY 
			EXTRACT(MONTH FROM birthday::date),
			EXTRACT(DAY FROM birthday::date),
			first_name, last_name
		LIMIT $4 OFFSET $5
	`

	rows, err := r.db.QueryContext(ctx, query, tenantID, today.Format("2006-01-02"), thirtyDaysFromNow.Format("2006-01-02"), limit, offset)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to query upcoming birthday contacts: %w", err)
	}
	defer rows.Close()

	var contacts []models.EmailContact
	for rows.Next() {
		var contact models.EmailContact
		err := rows.Scan(
			&contact.ID, &contact.TenantID, &contact.Email, &contact.FirstName, &contact.LastName,
			&contact.Status, &contact.AddedDate, &contact.LastActivity, &contact.EmailsSent,
			&contact.EmailsOpened, &contact.Birthday, &contact.BirthdayEmailEnabled,
		)
		if err != nil {
			return nil, 0, fmt.Errorf("failed to scan contact: %w", err)
		}
		contacts = append(contacts, contact)
	}

	return contacts, total, nil
}

// UpdateBulkBirthdayEmailPreference updates birthday email preference for multiple contacts
func (r *Repository) UpdateBulkBirthdayEmailPreference(ctx context.Context, tenantID string, contactIDs []string, enabled bool) error {
	if len(contactIDs) == 0 {
		return nil
	}

	// Create placeholders for the IN clause
	placeholders := make([]string, len(contactIDs))
	args := make([]interface{}, len(contactIDs)+2)
	args[0] = tenantID
	args[1] = enabled

	for i, contactID := range contactIDs {
		placeholders[i] = fmt.Sprintf("$%d", i+3)
		args[i+2] = contactID
	}

	query := fmt.Sprintf(`
		UPDATE email_contacts 
		SET birthday_email_enabled = $2, updated_at = CURRENT_TIMESTAMP
		WHERE tenant_id = $1 AND id IN (%s)
	`, strings.Join(placeholders, ","))

	_, err := r.db.ExecContext(ctx, query, args...)
	if err != nil {
		return fmt.Errorf("failed to update bulk birthday email preference: %w", err)
	}

	return nil
}

// GetContactByEmail retrieves a contact by email and tenant
func (r *Repository) GetContactByEmail(tenantID, email string) (*models.EmailContact, error) {
	query := `
		SELECT id, tenant_id, email, first_name, last_name, status,
		       added_date, last_activity, emails_sent, emails_opened,
		       birthday, birthday_email_enabled, consent_given, consent_date,
		       consent_method, consent_ip_address, consent_user_agent,
		       added_by_user_id, created_at, updated_at
		FROM email_contacts 
		WHERE tenant_id = $1 AND email = $2
	`

	var contact models.EmailContact
	err := r.db.QueryRow(query, tenantID, email).Scan(
		&contact.ID,
		&contact.TenantID,
		&contact.Email,
		&contact.FirstName,
		&contact.LastName,
		&contact.Status,
		&contact.AddedDate,
		&contact.LastActivity,
		&contact.EmailsSent,
		&contact.EmailsOpened,
		&contact.Birthday,
		&contact.BirthdayEmailEnabled,
		&contact.ConsentGiven,
		&contact.ConsentDate,
		&contact.ConsentMethod,
		&contact.ConsentIPAddress,
		&contact.ConsentUserAgent,
		&contact.AddedByUserID,
		&contact.CreatedAt,
		&contact.UpdatedAt,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get contact by email: %w", err)
	}

	return &contact, nil
}

// UpdateContactBirthday updates a contact's birthday information
func (r *Repository) UpdateContactBirthday(ctx context.Context, tenantID, contactID string, birthday *string, birthdayEmailEnabled *bool) (*models.EmailContact, error) {
	setParts := []string{}
	args := []interface{}{}
	argIndex := 1

	if birthday != nil {
		setParts = append(setParts, fmt.Sprintf("birthday = $%d", argIndex))
		args = append(args, *birthday)
		argIndex++
	}
	if birthdayEmailEnabled != nil {
		setParts = append(setParts, fmt.Sprintf("birthday_email_enabled = $%d", argIndex))
		args = append(args, *birthdayEmailEnabled)
		argIndex++
	}

	if len(setParts) == 0 {
		return r.GetContactByID(ctx, tenantID, contactID)
	}

	// Add updated_at
	setParts = append(setParts, fmt.Sprintf("updated_at = $%d", argIndex))
	args = append(args, time.Now())
	argIndex++

	// Add WHERE clause
	args = append(args, tenantID, contactID)

	query := fmt.Sprintf(`
		UPDATE email_contacts 
		SET %s
		WHERE tenant_id = $%d AND id = $%d
		RETURNING id, tenant_id, email, first_name, last_name, status,
		          added_date, last_activity, emails_sent, emails_opened,
		          birthday, birthday_email_enabled, consent_given, consent_date,
		          consent_method, consent_ip_address, consent_user_agent,
		          added_by_user_id, created_at, updated_at
	`, strings.Join(setParts, ", "), argIndex-1, argIndex)

	var contact models.EmailContact
	err := r.db.QueryRowContext(ctx, query, args...).Scan(
		&contact.ID,
		&contact.TenantID,
		&contact.Email,
		&contact.FirstName,
		&contact.LastName,
		&contact.Status,
		&contact.AddedDate,
		&contact.LastActivity,
		&contact.EmailsSent,
		&contact.EmailsOpened,
		&contact.Birthday,
		&contact.BirthdayEmailEnabled,
		&contact.ConsentGiven,
		&contact.ConsentDate,
		&contact.ConsentMethod,
		&contact.ConsentIPAddress,
		&contact.ConsentUserAgent,
		&contact.AddedByUserID,
		&contact.CreatedAt,
		&contact.UpdatedAt,
	)

	if err != nil {
		return nil, fmt.Errorf("failed to update contact birthday: %w", err)
	}

	return &contact, nil
}

// GetContactByID retrieves a contact by ID and tenant
func (r *Repository) GetContactByID(ctx context.Context, tenantID, contactID string) (*models.EmailContact, error) {
	query := `
		SELECT id, tenant_id, email, first_name, last_name, status,
		       added_date, last_activity, emails_sent, emails_opened,
		       birthday, birthday_email_enabled, consent_given, consent_date,
		       consent_method, consent_ip_address, consent_user_agent,
		       added_by_user_id, created_at, updated_at
		FROM email_contacts 
		WHERE tenant_id = $1 AND id = $2
	`

	var contact models.EmailContact
	err := r.db.QueryRowContext(ctx, query, tenantID, contactID).Scan(
		&contact.ID,
		&contact.TenantID,
		&contact.Email,
		&contact.FirstName,
		&contact.LastName,
		&contact.Status,
		&contact.AddedDate,
		&contact.LastActivity,
		&contact.EmailsSent,
		&contact.EmailsOpened,
		&contact.Birthday,
		&contact.BirthdayEmailEnabled,
		&contact.ConsentGiven,
		&contact.ConsentDate,
		&contact.ConsentMethod,
		&contact.ConsentIPAddress,
		&contact.ConsentUserAgent,
		&contact.AddedByUserID,
		&contact.CreatedAt,
		&contact.UpdatedAt,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get contact by ID: %w", err)
	}

	return &contact, nil
}

// CreateEmailActivity creates a new email activity record
func (r *Repository) CreateEmailActivity(activity *models.EmailActivity) error {
	if activity.ID == "" {
		activity.ID = uuid.New().String()
	}
	if activity.CreatedAt.IsZero() {
		activity.CreatedAt = time.Now()
	}

	query := `
		INSERT INTO email_activity (
			id, tenant_id, contact_id, campaign_id, newsletter_id,
			activity_type, activity_data, user_agent, ip_address,
			webhook_id, webhook_data, occurred_at, created_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
	`

	_, err := r.db.Exec(query,
		activity.ID,
		activity.TenantID,
		activity.ContactID,
		activity.CampaignID,
		activity.NewsletterID,
		activity.ActivityType,
		activity.ActivityData,
		activity.UserAgent,
		activity.IPAddress,
		activity.WebhookID,
		activity.WebhookData,
		activity.OccurredAt,
		activity.CreatedAt,
	)

	if err != nil {
		return fmt.Errorf("failed to create email activity: %w", err)
	}

	return nil
}

// GetTenant retrieves tenant information by ID
func (r *Repository) GetTenant(tenantID string) (*models.Tenant, error) {
	query := `
		SELECT id, name, created_at, updated_at
		FROM tenants 
		WHERE id = $1
	`

	var tenant models.Tenant
	err := r.db.QueryRow(query, tenantID).Scan(
		&tenant.ID,
		&tenant.Name,
		&tenant.CreatedAt,
		&tenant.UpdatedAt,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get tenant: %w", err)
	}

	return &tenant, nil
}

// CreateBirthdayUnsubscribeToken creates a new unsubscribe token for a contact
func (r *Repository) CreateBirthdayUnsubscribeToken(ctx context.Context, tenantID, contactID, token string) (*models.BirthdayUnsubscribeToken, error) {
	id := uuid.New().String()
	now := time.Now()

	query := `
		INSERT INTO birthday_unsubscribe_tokens (id, tenant_id, contact_id, token, used, created_at)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id, tenant_id, contact_id, token, used, created_at, used_at
	`

	var unsubToken models.BirthdayUnsubscribeToken
	err := r.db.QueryRowContext(ctx, query, id, tenantID, contactID, token, false, now).Scan(
		&unsubToken.ID,
		&unsubToken.TenantID,
		&unsubToken.ContactID,
		&unsubToken.Token,
		&unsubToken.Used,
		&unsubToken.CreatedAt,
		&unsubToken.UsedAt,
	)

	if err != nil {
		return nil, fmt.Errorf("failed to create birthday unsubscribe token: %w", err)
	}

	return &unsubToken, nil
}

// GetBirthdayUnsubscribeToken retrieves an unsubscribe token by token string
func (r *Repository) GetBirthdayUnsubscribeToken(ctx context.Context, token string) (*models.BirthdayUnsubscribeToken, error) {
	query := `
		SELECT id, tenant_id, contact_id, token, used, created_at, used_at
		FROM birthday_unsubscribe_tokens
		WHERE token = $1
	`

	var unsubToken models.BirthdayUnsubscribeToken
	err := r.db.QueryRowContext(ctx, query, token).Scan(
		&unsubToken.ID,
		&unsubToken.TenantID,
		&unsubToken.ContactID,
		&unsubToken.Token,
		&unsubToken.Used,
		&unsubToken.CreatedAt,
		&unsubToken.UsedAt,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get birthday unsubscribe token: %w", err)
	}

	return &unsubToken, nil
}

// MarkBirthdayUnsubscribeTokenUsed marks an unsubscribe token as used
func (r *Repository) MarkBirthdayUnsubscribeTokenUsed(ctx context.Context, tokenID string) error {
	now := time.Now()
	query := `
		UPDATE birthday_unsubscribe_tokens 
		SET used = true, used_at = $1
		WHERE id = $2
	`

	_, err := r.db.ExecContext(ctx, query, now, tokenID)
	if err != nil {
		return fmt.Errorf("failed to mark birthday unsubscribe token as used: %w", err)
	}

	return nil
}

// UnsubscribeContactFromBirthdayEmails unsubscribes a contact from birthday emails
func (r *Repository) UnsubscribeContactFromBirthdayEmails(ctx context.Context, contactID string, reason *string) error {
	now := time.Now()
	query := `
		UPDATE email_contacts 
		SET birthday_email_enabled = false, 
		    birthday_unsubscribe_reason = $1,
		    birthday_unsubscribed_at = $2,
		    updated_at = $3
		WHERE id = $4
	`

	_, err := r.db.ExecContext(ctx, query, reason, now, now, contactID)
	if err != nil {
		return fmt.Errorf("failed to unsubscribe contact from birthday emails: %w", err)
	}

	return nil
}

// ResubscribeContactToBirthdayEmails resubscribes a contact to birthday emails
func (r *Repository) ResubscribeContactToBirthdayEmails(ctx context.Context, contactID string) error {
	now := time.Now()
	query := `
		UPDATE email_contacts 
		SET birthday_email_enabled = true, 
		    birthday_unsubscribe_reason = NULL,
		    birthday_unsubscribed_at = NULL,
		    updated_at = $1
		WHERE id = $2
	`

	_, err := r.db.ExecContext(ctx, query, now, contactID)
	if err != nil {
		return fmt.Errorf("failed to resubscribe contact to birthday emails: %w", err)
	}

	return nil
}

// ResetBirthdayUnsubscribeToken resets a birthday unsubscribe token to unused status
func (r *Repository) ResetBirthdayUnsubscribeToken(ctx context.Context, tokenID string) error {
	query := `
		UPDATE birthday_unsubscribe_tokens 
		SET used = false, used_at = NULL
		WHERE id = $1
	`

	_, err := r.db.ExecContext(ctx, query, tokenID)
	if err != nil {
		return fmt.Errorf("failed to reset birthday unsubscribe token: %w", err)
	}

	return nil
}

// GetPromotion retrieves a promotion by ID and tenant ID
func (r *Repository) GetPromotion(ctx context.Context, promotionID, tenantID string) (*models.Promotion, error) {
	query := `
		SELECT id, tenant_id, user_id, title, description, content, type, 
		       target_audience, is_active, usage_count, max_uses, 
		       valid_from, valid_to, created_at, updated_at
		FROM promotions 
		WHERE id = $1 AND tenant_id = $2
	`

	var promotion models.Promotion
	err := r.db.QueryRowContext(ctx, query, promotionID, tenantID).Scan(
		&promotion.ID,
		&promotion.TenantID,
		&promotion.UserID,
		&promotion.Title,
		&promotion.Description,
		&promotion.Content,
		&promotion.Type,
		&promotion.TargetAudience,
		&promotion.IsActive,
		&promotion.UsageCount,
		&promotion.MaxUses,
		&promotion.ValidFrom,
		&promotion.ValidTo,
		&promotion.CreatedAt,
		&promotion.UpdatedAt,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get promotion: %w", err)
	}

	return &promotion, nil
}
