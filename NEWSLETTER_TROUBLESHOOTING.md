# Newsletter System Troubleshooting Guide

## 🚨 Common Issue: "No recipients found for this newsletter"

### Root Cause
The newsletter system requires **email contacts** to exist in the database before you can send newsletters. If you try to send a newsletter with `recipientType: 'all'` but have no email contacts, the system will return an error.

## ✅ Solution: Create Email Contacts First

### Step 1: Navigate to Email Contacts
1. Go to your application at http://localhost:4000 (or your deployed URL)
2. Login with your credentials
3. Navigate to **Email Marketing** → **Contacts** in the sidebar

### Step 2: Add Email Contacts
1. Click **"Add Contact"** button
2. Fill in the contact details:
   - Email address (required)
   - First name
   - Last name
   - Ensure **"Active"** status is selected
   - Check **"Consent Given"** checkbox
3. Click **"Save"**
4. Repeat for multiple contacts if needed

### Step 3: Create and Send Newsletter
1. Navigate to **Email Marketing** → **Newsletters**
2. Click **"Create Newsletter"**
3. Fill in the newsletter details:
   - Title
   - Subject
   - Content (use the rich text editor)
4. In **Recipient Selection**:
   - Choose **"All Contacts"** to send to everyone
   - Or choose **"Selected Contacts"** to pick specific ones
   - Or choose **"By Tags"** if you've tagged your contacts
5. Click **"Send Now"**

## 🔍 Verification Steps

### 1. Check Go Server Health
```bash
curl https://tengine.zendwise.work/health
```
Expected response:
```json
{"status":"healthy","temporal":"connected","time":"2025-08-14T..."}
```

### 2. Check Email Tracking (requires auth token)
```bash
# Get auth token first by logging in via the UI
# Then check tracking entries
curl -H "Authorization: Bearer YOUR_TOKEN" https://tengine.zendwise.work/api/email-tracking
```

### 3. Check Temporal Worker Logs
```bash
cd /home/coder/Authentik/server-go
tail -f worker.log
```

## 📊 Newsletter Flow Diagram

```
1. User creates newsletter in UI
   ↓
2. Newsletter saved to database
   ↓
3. User clicks "Send"
   ↓
4. Server checks for recipients based on recipientType
   ↓
5. If no recipients found → Error: "No recipients found"
   ↓
6. If recipients found → Call Go server for each recipient
   ↓
7. Go server creates Temporal workflow
   ↓
8. Temporal executes SendEmail activity
   ↓
9. Resend API sends actual email
   ↓
10. Status updated to "sent"
```

## 🐛 Debugging Checklist

- [ ] Email contacts exist in the system
- [ ] Go server is running (port 8095)
- [ ] Temporal worker is running
- [ ] User is properly authenticated
- [ ] Newsletter has valid recipient configuration
- [ ] JWT_SECRET matches between services

## 🚀 Quick Test

Run the provided test script:
```bash
cd /home/coder/Authentik
node test-newsletter-flow.js
```

This will test the entire flow and show you exactly where any issues occur.

