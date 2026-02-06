import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { enhancedEmailService } from '../emailService';
import { db } from '../db';
import { and, eq, sql } from 'drizzle-orm';
import { unsubscribeTokens, emailContacts, emailActivity } from '@shared/schema';

export const emailRoutes = Router();

const unsubscribeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 20, // Limit each IP to 20 requests per `window` (here, per 15 minutes)
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: 'Too many requests from this IP, please try again later',
});

// Email system status endpoint
emailRoutes.get('/status', async (req, res) => {
  try {
    const status = enhancedEmailService.getStatus();
    const healthCheck = await enhancedEmailService.healthCheck();

    res.json({
      status: 'operational',
      timestamp: new Date().toISOString(),
      health: healthCheck,
      details: status
    });
  } catch (error) {
    console.error('[EmailRoutes] Status check failed:', error);
    res.status(500).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// One-click unsubscribe endpoint (RFC 8058) using POST with no body response
// This unsubscribes from ALL email categories
emailRoutes.post('/unsubscribe', async (req, res) => {
  try {
    const token = (req.body?.token as string) || (req.query.token as string) || '';
    if (!token) {
      return res.status(400).end();
    }

    const tokenRow = await db.query.unsubscribeTokens.findFirst({
      where: eq(unsubscribeTokens.token, token),
    });

    if (!tokenRow) {
      return res.status(204).end();
    }

    // Unsubscribe from all categories and set status to unsubscribed
    await db.update(emailContacts)
      .set({
        status: 'unsubscribed' as any,
        prefMarketing: false,
        prefCustomerEngagement: false,
        prefNewsletters: false,
        prefSurveysForms: false,
        updatedAt: new Date() as any,
      })
      .where(and(eq(emailContacts.id, tokenRow.contactId), eq(emailContacts.tenantId, tokenRow.tenantId)));

    // Mark token as used (but token can still be used for preference management page)
    if (!tokenRow.usedAt) {
      await db.update(unsubscribeTokens)
        .set({ usedAt: new Date() as any })
        .where(eq(unsubscribeTokens.id, tokenRow.id));
    }

    await db.insert(emailActivity).values({
      contactId: tokenRow.contactId,
      tenantId: tokenRow.tenantId,
      activityType: 'unsubscribed',
      activityData: JSON.stringify({ source: 'unsubscribe_one_click', tokenId: tokenRow.id, categories: 'all' }),
      occurredAt: new Date(),
    });

    return res.status(204).end();
  } catch (error) {
    console.error('[EmailRoutes] Unsubscribe POST failed:', error);
    return res.status(204).end();
  }
});

// Save granular email preferences
emailRoutes.post('/unsubscribe/preferences', unsubscribeLimiter, async (req, res) => {
  try {
    const { token, preferences, unsubscribeAll } = req.body;
    if (!token) {
      return res.status(400).json({ success: false, error: 'Missing token' });
    }

    const tokenRow = await db.query.unsubscribeTokens.findFirst({
      where: eq(unsubscribeTokens.token, token),
    });

    if (!tokenRow) {
      return res.status(400).json({ success: false, error: 'Invalid token' });
    }

    const now = new Date();

    if (unsubscribeAll) {
      // Unsubscribe from everything
      await db.update(emailContacts)
        .set({
          status: 'unsubscribed' as any,
          prefMarketing: false,
          prefCustomerEngagement: false,
          prefNewsletters: false,
          prefSurveysForms: false,
          updatedAt: now as any,
        })
        .where(and(eq(emailContacts.id, tokenRow.contactId), eq(emailContacts.tenantId, tokenRow.tenantId)));

      await db.insert(emailActivity).values({
        contactId: tokenRow.contactId,
        tenantId: tokenRow.tenantId,
        activityType: 'unsubscribed',
        activityData: JSON.stringify({ source: 'preference_page', categories: 'all' }),
        occurredAt: now,
      });
    } else if (preferences && typeof preferences === 'object') {
      // Update individual preferences
      const updateData: Record<string, any> = { updatedAt: now };
      const changedCategories: string[] = [];

      if (typeof preferences.marketing === 'boolean') {
        updateData.prefMarketing = preferences.marketing;
        if (!preferences.marketing) changedCategories.push('marketing');
      }
      if (typeof preferences.customerEngagement === 'boolean') {
        updateData.prefCustomerEngagement = preferences.customerEngagement;
        if (!preferences.customerEngagement) changedCategories.push('customer_engagement');
      }
      if (typeof preferences.newsletters === 'boolean') {
        updateData.prefNewsletters = preferences.newsletters;
        if (!preferences.newsletters) changedCategories.push('newsletters');
      }
      if (typeof preferences.surveysForms === 'boolean') {
        updateData.prefSurveysForms = preferences.surveysForms;
        if (!preferences.surveysForms) changedCategories.push('surveys_forms');
      }

      // Determine if all categories are opted out
      const contact = await db.query.emailContacts.findFirst({
        where: and(eq(emailContacts.id, tokenRow.contactId), eq(emailContacts.tenantId, tokenRow.tenantId)),
        columns: { status: true, prefMarketing: true, prefCustomerEngagement: true, prefNewsletters: true, prefSurveysForms: true },
      });
      if (!contact) {
        return res.status(404).json({ success: false, error: 'Contact not found' });
      }

      // Merge current prefs with updates to check final state
      const finalPrefs = {
        marketing: updateData.prefMarketing ?? contact?.prefMarketing ?? true,
        customerEngagement: updateData.prefCustomerEngagement ?? contact?.prefCustomerEngagement ?? true,
        newsletters: updateData.prefNewsletters ?? contact?.prefNewsletters ?? true,
        surveysForms: updateData.prefSurveysForms ?? contact?.prefSurveysForms ?? true,
      };

      const allOptedOut = !finalPrefs.marketing && !finalPrefs.customerEngagement && !finalPrefs.newsletters && !finalPrefs.surveysForms;
      if (allOptedOut) {
        updateData.status = 'unsubscribed';
      } else {
        // Re-activate if they were previously fully unsubscribed but now opted back in
        updateData.status = contact.status === 'bounced' ? 'bounced' : 'active';
      }

      await db.update(emailContacts)
        .set(updateData)
        .where(and(eq(emailContacts.id, tokenRow.contactId), eq(emailContacts.tenantId, tokenRow.tenantId)));

      if (changedCategories.length > 0) {
        await db.insert(emailActivity).values({
          contactId: tokenRow.contactId,
          tenantId: tokenRow.tenantId,
          activityType: 'preference_updated',
          activityData: JSON.stringify({ source: 'preference_page', unsubscribedFrom: changedCategories, preferences: finalPrefs }),
          occurredAt: now,
        });
      }
    }

    return res.json({ success: true });
  } catch (error) {
    console.error('[EmailRoutes] Save preferences failed:', error);
    return res.status(500).json({ success: false, error: 'Failed to save preferences' });
  }
});


// Send custom email endpoint (for testing)
emailRoutes.post('/send', async (req, res) => {
  try {
    const {
      to,
      subject,
      html,
      text,
      preferredProvider,
      useQueue,
      metadata,
      fromEmail,
      tenantId,
      tenantName
    } = req.body;

    if (!to || !subject || !html) {
      return res.status(400).json({
        status: 'error',
        message: 'Missing required fields: to, subject, html',
        timestamp: new Date().toISOString()
      });
    }

    const result = await enhancedEmailService.sendCustomEmail(
      to,
      subject,
      html,
      {
        text,
        from: fromEmail,
        preferredProvider,
        metadata: {
          source: 'api',
          requestId: req.get('x-request-id') || 'unknown',
          tenantId,
          tenantName,
          ...(metadata || {})
        }
      }
    );

    res.json({
      status: 'success',
      result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[EmailRoutes] Send email failed:', error);
    res.status(500).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});


// Health check endpoint
emailRoutes.get('/health', async (req, res) => {
  try {
    const health = await enhancedEmailService.healthCheck();
    const isHealthy = health.healthy;

    res.status(isHealthy ? 200 : 503).json({
      status: isHealthy ? 'healthy' : 'unhealthy',
      providers: health.providers,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[EmailRoutes] Health check failed:', error);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Provider configuration endpoints (for admin use)
emailRoutes.get('/providers', async (req, res) => {
  try {
    const status = enhancedEmailService.getStatus();

    res.json({
      providers: status.providers,
      summary: status,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[EmailRoutes] Provider list failed:', error);
    res.status(500).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Public unsubscribe endpoint — shows preference management page
emailRoutes.get('/unsubscribe', unsubscribeLimiter, async (req, res) => {
  try {
    const token = (req.query.token as string) || '';
    const emailType = (req.query.type as string) || '';
    if (!token) {
      return res.status(400).type('text/html').send('<html><body><h1>Invalid request</h1><p>Missing token.</p></body></html>');
    }

    const tokenRow = await db.query.unsubscribeTokens.findFirst({
      where: eq(unsubscribeTokens.token, token),
    });

    if (!tokenRow) {
      return res.status(400).type('text/html').send('<html><body><h1>Invalid link</h1><p>This unsubscribe link is invalid.</p></body></html>');
    }

    // Fetch current contact preferences
    const contact = await db.query.emailContacts.findFirst({
      where: and(eq(emailContacts.id, tokenRow.contactId), eq(emailContacts.tenantId, tokenRow.tenantId)),
      columns: {
        email: true,
        firstName: true,
        prefMarketing: true,
        prefCustomerEngagement: true,
        prefNewsletters: true,
        prefSurveysForms: true,
      },
    });

    if (!contact) {
      return res.status(400).type('text/html').send('<html><body><h1>Contact not found</h1><p>This unsubscribe link is no longer valid.</p></body></html>');
    }

    // Mask email for display
    const emailParts = contact.email.split('@');
    const maskedEmail = emailParts.length === 2 && emailParts[0].length > 0
      ? emailParts[0].substring(0, 2) + '***@' + emailParts[1]
      : '***';
    const displayName = contact.firstName || maskedEmail;

    // Map emailType query param to a human-readable label for the highlight
    const typeLabels: Record<string, string> = {
      marketing: 'Marketing',
      customer_engagement: 'Customer Engagement',
      newsletters: 'Newsletters',
      surveys_forms: 'Surveys & Forms',
    };
    const highlightLabel = typeLabels[emailType] || '';

    return res.status(200).type('text/html').send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Email Preferences</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    :root {
      --background: 210 40% 98%;
      --foreground: 222.2 84% 4.9%;
      --card: 0 0% 100%;
      --card-foreground: 222.2 84% 4.9%;
      --popover: 0 0% 100%;
      --popover-foreground: 222.2 84% 4.9%;
      --primary: 222.2 47.4% 11.2%;
      --primary-foreground: 210 40% 98%;
      --secondary: 210 40% 96.1%;
      --secondary-foreground: 222.2 47.4% 11.2%;
      --muted: 210 40% 96.1%;
      --muted-foreground: 215.4 16.3% 46.9%;
      --accent: 210 40% 96.1%;
      --accent-foreground: 222.2 47.4% 11.2%;
      --destructive: 0 84.2% 60.2%;
      --destructive-foreground: 210 40% 98%;
      --border: 214.3 31.8% 91.4%;
      --input: 214.3 31.8% 91.4%;
      --ring: 222.2 84% 4.9%;
      --radius: 0.5rem;
    }
    body {
      font-family: 'Inter', sans-serif;
    }
    /* Custom Switch Implementation mimicking Radix UI */
    .switch-root {
      width: 42px;
      height: 25px;
      background-color: #e2e8f0;
      border-radius: 9999px;
      position: relative;
      background-color: hsl(210, 40%, 96.1%); /* secondary */
      border: 1px solid transparent;
      transition: background-color 0.15s ease-in-out;
      cursor: pointer;
    }
    .switch-root[data-state="checked"] {
      background-color: hsl(222.2, 47.4%, 11.2%); /* primary */
    }
    .switch-thumb {
      display: block;
      width: 21px;
      height: 21px;
      background-color: white;
      border-radius: 9999px;
      box-shadow: 0 2px 4px 0 rgba(0, 0, 0, 0.06);
      transition: transform 0.15s cubic-bezier(0.19, 1, 0.22, 1);
      transform: translateX(2px);
      pointer-events: none;
      margin-top: 1px;
    }
    .switch-root[data-state="checked"] .switch-thumb {
      transform: translateX(19px);
    }
    /* Checkbox hidden input */
    .switch-input {
      position: absolute;
      opacity: 0;
      width: 0;
      height: 0;
    }
  </style>
</head>
<body class="bg-slate-50 min-h-screen flex items-center justify-center p-4 text-slate-950">
  <div class="bg-white w-full max-w-[480px] rounded-xl border border-slate-200 shadow-sm overflow-hidden">
    
    <!-- Header -->
    <div class="p-6 pb-2">
      <h1 class="text-2xl font-semibold tracking-tight">Email Preferences</h1>
      <p class="text-sm text-slate-500 mt-1">Manage which emails you receive from us</p>
    </div>

    <div class="p-6 pt-4">
      <!-- Success Message -->
      <div id="successMsg" class="hidden mb-6 bg-green-50 border border-green-200 text-green-800 rounded-lg p-4 text-sm">
        <div class="flex items-center gap-2 font-medium mb-1">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
          Preferences Saved
        </div>
        <p class="text-green-700">Your email preferences have been updated successfully.</p>
      </div>

      <!-- Unsubscribed Message -->
      <div id="unsubMsg" class="hidden mb-6 bg-slate-100 border border-slate-200 text-slate-800 rounded-lg p-4 text-sm">
        <div class="flex items-center gap-2 font-medium mb-1">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>
          Unsubscribed
        </div>
        <p class="text-slate-600">You have been unsubscribed from all emails.</p>
      </div>

      <div id="formContent">
        <p class="text-sm text-slate-500 mb-6 leading-relaxed">
          Hi <span class="font-medium text-slate-900">${displayName.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</span>, customize your subscription settings below:
        </p>

        ${highlightLabel ? `
        <div class="mb-6 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3">
          <svg class="w-4 h-4 text-amber-600 mt-0.5 shrink-0" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <div class="text-sm text-amber-900">
            This email was sent as <span class="font-medium">${highlightLabel}</span>. You can opt-out of this specific category below.
          </div>
        </div>` : ''}

        <div id="errorMsg" class="hidden mb-4 p-3 bg-red-50 text-red-600 border border-red-200 rounded-md text-sm"></div>

        <div class="space-y-6">
          
          <!-- Marketing Item -->
          <div class="flex items-start justify-between space-x-4">
            <div class="space-y-0.5">
              <label class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70" for="pref_marketing">
                Marketing
              </label>
              <p class="text-[0.8rem] text-slate-500">
                Promotional offers, deals, and product announcements.
              </p>
            </div>
            <div class="switch-root" data-state="${contact.prefMarketing ? 'checked' : 'unchecked'}" data-target="pref_marketing">
              <span class="switch-thumb"></span>
              <input type="checkbox" id="pref_marketing" class="switch-input" ${contact.prefMarketing ? 'checked' : ''}>
            </div>
          </div>
          
          <div class="h-px bg-slate-100"></div>

          <!-- Customer Engagement Item -->
          <div class="flex items-start justify-between space-x-4">
            <div class="space-y-0.5">
              <label class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70" for="pref_customer_engagement">
                Customer Engagement
              </label>
              <p class="text-[0.8rem] text-slate-500">
                Birthday wishes, personalized messages, and loyalty rewards.
              </p>
            </div>
            <div class="switch-root" data-state="${contact.prefCustomerEngagement ? 'checked' : 'unchecked'}" data-target="pref_customer_engagement">
              <span class="switch-thumb"></span>
              <input type="checkbox" id="pref_customer_engagement" class="switch-input" ${contact.prefCustomerEngagement ? 'checked' : ''}>
            </div>
          </div>

          <div class="h-px bg-slate-100"></div>

          <!-- Newsletters Item -->
          <div class="flex items-start justify-between space-x-4">
            <div class="space-y-0.5">
              <label class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70" for="pref_newsletters">
                Newsletters
              </label>
              <p class="text-[0.8rem] text-slate-500">
                Regular updates, news, and monthly digests.
              </p>
            </div>
            <div class="switch-root" data-state="${contact.prefNewsletters ? 'checked' : 'unchecked'}" data-target="pref_newsletters">
              <span class="switch-thumb"></span>
              <input type="checkbox" id="pref_newsletters" class="switch-input" ${contact.prefNewsletters ? 'checked' : ''}>
            </div>
          </div>

          <div class="h-px bg-slate-100"></div>

          <!-- Surveys Item -->
          <div class="flex items-start justify-between space-x-4">
            <div class="space-y-0.5">
              <label class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70" for="pref_surveys_forms">
                Surveys & Forms
              </label>
              <p class="text-[0.8rem] text-slate-500">
                Feedback requests and satisfaction surveys.
              </p>
            </div>
            <div class="switch-root" data-state="${contact.prefSurveysForms ? 'checked' : 'unchecked'}" data-target="pref_surveys_forms">
              <span class="switch-thumb"></span>
              <input type="checkbox" id="pref_surveys_forms" class="switch-input" ${contact.prefSurveysForms ? 'checked' : ''}>
            </div>
          </div>

        </div>

        <div class="mt-8 space-y-4">
          <button id="saveBtn" class="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-slate-900 text-slate-50 hover:bg-slate-900/90 h-10 px-4 py-2 w-full">
            Save Preferences
          </button>
          
          <button id="unsubAllBtn" class="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 text-red-500 hover:text-red-700 hover:bg-red-50 h-9 px-4 py-2 w-full">
            Unsubscribe from all emails
          </button>
        </div>
      </div>
    </div>
  </div>

  <script>
    var TOKEN = ${JSON.stringify(token)};

    function toggleSwitch(element, inputId) {
      const checkbox = document.getElementById(inputId);
      checkbox.checked = !checkbox.checked;
      element.setAttribute('data-state', checkbox.checked ? 'checked' : 'unchecked');
    }

    // Attach click handlers to all switches (CSP-safe: no inline handlers)
    document.querySelectorAll('.switch-root[data-target]').forEach(function(el) {
      el.addEventListener('click', function() {
        toggleSwitch(this, this.getAttribute('data-target'));
      });
    });

    document.getElementById('saveBtn').addEventListener('click', function() {
      var btn = document.getElementById('saveBtn');
      var originalText = btn.textContent;
      
      btn.disabled = true;
      btn.innerHTML = '<svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Saving...';
      
      document.getElementById('errorMsg').style.display = 'none';
      
      var prefs = {
        marketing: document.getElementById('pref_marketing').checked,
        customerEngagement: document.getElementById('pref_customer_engagement').checked,
        newsletters: document.getElementById('pref_newsletters').checked,
        surveysForms: document.getElementById('pref_surveys_forms').checked,
      };

      fetch('/api/email/unsubscribe/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: TOKEN, preferences: prefs }),
      }).then(function(r) { return r.json(); }).then(function(data) {
        if (data.success) {
          document.getElementById('formContent').classList.add('hidden');
          const headerP = document.querySelector('.header p');
          if (headerP) headerP.remove();
          document.getElementById('successMsg').classList.remove('hidden');
          // Update header title to be more generic after save
          const h1 = document.querySelector('h1');
          if (h1) h1.textContent = 'Preferences Updated';
        } else {
          showError(data.error || 'Failed to save preferences.');
          resetBtn(btn, originalText);
        }
      }).catch(function() {
        showError('Network error. Please try again.');
        resetBtn(btn, originalText);
      });
    });

    document.getElementById('unsubAllBtn').addEventListener('click', function() {
      if (!confirm('Are you sure you want to unsubscribe from all emails?')) return;
      
      var btn = document.getElementById('unsubAllBtn');
      var originalText = btn.textContent;
      
      btn.disabled = true;
      btn.textContent = 'Unsubscribing...';
      document.getElementById('errorMsg').style.display = 'none';

      fetch('/api/email/unsubscribe/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: TOKEN, unsubscribeAll: true }),
      }).then(function(r) { return r.json(); }).then(function(data) {
        if (data.success) {
          document.getElementById('formContent').classList.add('hidden');
          const headerP = document.querySelector('.header p');
          if (headerP) headerP.remove();
          document.getElementById('unsubMsg').classList.remove('hidden');
          const h1 = document.querySelector('h1');
          if (h1) h1.textContent = 'Unsubscribed';
        } else {
          showError(data.error || 'Failed to unsubscribe.');
          resetBtn(btn, originalText);
        }
      }).catch(function() {
        showError('Network error. Please try again.');
        resetBtn(btn, originalText);
      });
    });

    function showError(msg) {
      var el = document.getElementById('errorMsg');
      el.textContent = msg;
      el.classList.remove('hidden');
      el.style.display = 'block';
    }

    function resetBtn(btn, text) {
      btn.disabled = false;
      btn.textContent = text;
    }
  </script>
</body>
</html>`);
  } catch (error) {
    console.error('[EmailRoutes] Unsubscribe page failed:', error);
    return res.status(500).type('text/html').send('<html><body><h1>Error</h1><p>Failed to load preferences. Please try again later.</p></body></html>');
  }
});