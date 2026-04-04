# Appointments

- [x] Add global option to send out multi-reminder of upcoming appointments when user has not verified it few hours before the appointment time
  - [x] Per-tenant toggle (Owner/Admin) via `PUT /api/appointments/auto-reminder-settings`
  - [x] Worker runs every 5 min, sends email 1 hr before unconfirmed appointments
  - [x] Deduplication via `auto_1h` timing marker in appointment_reminders table
  - [x] Email suppression checks (bounced, inactive contacts)
- [ ] Add button to confirm verification and get taken to the dashboard
  - Confirmation link in appointment email takes customer to a confirmation page
  - After confirming, redirect to customer-facing dashboard or thank-you page
- [ ] Add company contact details to confirm/delete appointment pages
  - Show business name, phone, email, address on confirmation and cancellation pages
  - Pull from shop/company settings
- [ ] Add note to appointment email: "Please disregard this message if you have already called in your confirmation."
  - Add as configurable footer text in appointment email templates
  - Default enabled, can be toggled off per shop
