# Email & Newsletters

## Unsubscribe Handling

- [ ] Properly filter users who are unsubbed from email newsletters from receiving them
  - Check unsubscribe status before building recipient list for newsletter sends
  - Respect per-contact and per-list unsubscribe preferences
- [ ] Add consistency to unsubbed emails when being deleted and re-added to the list
  - When a contact is deleted and re-imported, preserve their unsubscribe status
  - Maintain unsubscribe history tied to email address, not just contact record

## Content & Sending

- [x] Add password/2FA confirmation requirement before sending newsletters
  - ~~Add per-tenant toggle in /management section (Owner/Admin only)~~
  - ~~When enabled, require user to enter account password (or verify 2FA TOTP code if 2FA is enabled) before the send is dispatched~~
  - ~~Enforce in the UI at the point of clicking "Send" — show a confirmation modal prompting for credentials~~
  - ~~Server-side enforcement on POST /:id/send: verify credentials before accepting the request, reject with 403 if check fails~~
  - ~~Store setting in a new `newsletter_send_confirmation` column on `tenant_settings` (or a dedicated table) defaulting to `false`~~

- [x] Add basic content moderation to newsletter content
  - ~~Flag or block emails containing prohibited content patterns to being, these would be simple bad words, rasism, adult content, and other related keywords.~~
  - ~~Add review step for first-time senders or flagged content~~
- [ ] Add confirmation to single email sending modal windows
  - Show "Are you sure?" confirmation before sending individual emails
  - Display recipient and subject in confirmation dialog
- [ ] Implement read subdomain or inbox-like sending for onboarding customers
  - Setup subdomain-based sending (e.g., mail.clientdomain.com)
  - Guide new customers through DNS/domain verification during onboarding

## Newsletter Post-Send

- [ ] FINALIZE what should be gathered after 24hrs have passed of sending a newsletter
  - Define metrics to collect: opens, clicks, bounces, unsubscribes, spam complaints
  - Determine what gets summarized vs stored raw
  - Build scheduled job to aggregate and store final stats after 24hr window
- [ ] Add Welcome emails in form signups via templates
  - Allow associating an email template with a form
  - Auto-send welcome email when a new contact signs up through a form
