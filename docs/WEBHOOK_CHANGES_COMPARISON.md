# Webhook Implementation: Before vs After

## Main Handler Function Changes

### Before: `handleEmailOpened()`
```typescript
async function handleEmailOpened(data: any) {
  // Extract recipient email from webhook data
  const recipientEmail = extractRecipientEmail(data);
  
  // Find the contact record by email
  const contact = await findContactByEmail(recipientEmail);
  
  // Update contact metrics
  await updateContactMetrics(contact.id, 'opened');
  
  // Create email activity record linked to contact
  await createEmailActivity(contact.id, data, 'opened', recipientEmail);
}
```

### After: `handleEmailOpened()`
```typescript
async function handleEmailOpened(data: any) {
  // Extract provider_message_id (email_id from Resend)
  const providerMessageId = extractProviderMessageId(data);
  
  // Find the email_sends record by provider_message_id
  const emailSend = await findEmailSendByProviderId(providerMessageId);
  
  // Create email_events record linked to email_send
  await createEmailEvent(emailSend.id, data, 'opened');
  
  // Update contact metrics if contact is linked
  if (emailSend.contactId) {
    await updateContactMetrics(emailSend.contactId, 'opened');
  }
}
```

## Key Differences

| Aspect | Before | After |
|--------|--------|-------|
| **Primary Lookup** | Email address (recipient) | provider_message_id (email_id) |
| **Lookup Function** | `findContactByEmail()` | `findEmailSendByProviderId()` |
| **Record Created** | `email_activity` | `email_events` |
| **Foreign Key** | Links to `email_contacts` | Links to `email_sends` |
| **Data Source** | Webhook data + manual extraction | Self-contained in `email_sends` |
| **Contact Link** | Required (lookup fails if not found) | Optional (via `emailSend.contactId`) |

## Helper Function Changes

### Before: `extractRecipientEmail()`
```typescript
function extractRecipientEmail(data: any): string | null {
  // Handle different webhook formats
  if (data.to && Array.isArray(data.to)) {
    return data.to[0];
  }
  if (data.Email) {
    return data.Email;
  }
  // ... more fallbacks
  return null;
}
```

### After: `extractProviderMessageId()`
```typescript
function extractProviderMessageId(data: any): string | null {
  // Resend format - uses email_id
  if (data.email_id) {
    return data.email_id;
  }
  // Postmark format - uses MessageID
  if (data.MessageID) {
    return data.MessageID;
  }
  // Fallback
  if (data.id) {
    return data.id;
  }
  return null;
}
```

## Database Queries

### Before
```typescript
// Find contact by email
const contact = await db.query.emailContacts.findFirst({
  where: sql`${db.emailContacts.email} = ${email}`,
});

// Insert into email_activity
await db.insert(db.emailActivity).values({
  contactId: contact.id,
  activityType: 'opened',
  activityData: JSON.stringify(webhookData),
  // ...
});
```

### After
```typescript
// Find email_send by provider_message_id
const emailSend = await db.query.emailSends.findFirst({
  where: sql`${db.emailSends.providerMessageId} = ${providerMessageId}`,
});

// Update email_sends status (for sent/delivered events)
await db.update(db.emailSends)
  .set({ status: 'delivered', deliveredAt: new Date() })
  .where(sql`${db.emailSends.id} = ${emailSend.id}`);

// Insert into email_events
await db.insert(db.emailEvents).values({
  emailSendId: emailSend.id,
  eventType: 'opened',
  eventData: JSON.stringify(webhookData),
  // ...
});
```

## Benefits of New Approach

1. **Unique Identification**: provider_message_id is unique per email, email addresses are not
2. **Direct Lookup**: Indexed provider_message_id lookup is faster than email string matching
3. **Self-Contained**: All email data is in email_sends, no need to reconstruct from webhook
4. **Event History**: email_events maintains complete history of all webhook events
5. **Flexible Contact Linking**: Contacts can be optional, supporting transactional emails
6. **Multi-Send Support**: Can track multiple sends to same email without confusion

## Migration Checklist

- [x] Update webhook handlers to use provider_message_id
- [x] Create extractProviderMessageId() function
- [x] Create findEmailSendByProviderId() function
- [x] Create createEmailEvent() function for email_events table
- [x] Update handlers to create email_events instead of email_activity
- [x] Update test endpoint to accept email_id parameter
- [ ] Ensure all email sending code populates provider_message_id
- [ ] Test with real Resend webhooks
- [ ] Verify email_events records are created correctly
