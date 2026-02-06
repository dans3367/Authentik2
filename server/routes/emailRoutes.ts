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
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f1f5f9; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; color: #334155; }
    .card { background: white; border-radius: 16px; box-shadow: 0 4px 24px rgba(0,0,0,0.08); max-width: 520px; width: 100%; overflow: hidden; }
    .header { background: linear-gradient(135deg, #3b82f6 0%, #1e40af 100%); padding: 32px 28px; color: white; text-align: center; }
    .header h1 { font-size: 22px; font-weight: 700; margin-bottom: 6px; }
    .header p { font-size: 14px; opacity: 0.9; }
    .body { padding: 28px; }
    .greeting { font-size: 15px; color: #64748b; margin-bottom: 20px; line-height: 1.5; }
    ${highlightLabel ? `.highlight-banner { background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 12px 16px; margin-bottom: 20px; font-size: 13px; color: #92400e; }
    .highlight-banner strong { color: #78350f; }` : ''}
    .pref-group { border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; margin-bottom: 20px; }
    .pref-item { display: flex; align-items: center; justify-content: space-between; padding: 16px 18px; border-bottom: 1px solid #f1f5f9; transition: background 0.15s; }
    .pref-item:last-child { border-bottom: none; }
    .pref-item:hover { background: #f8fafc; }
    .pref-info { flex: 1; margin-right: 16px; }
    .pref-label { font-size: 15px; font-weight: 600; color: #1e293b; margin-bottom: 2px; }
    .pref-desc { font-size: 12px; color: #94a3b8; line-height: 1.4; }
    .toggle { position: relative; width: 48px; height: 26px; flex-shrink: 0; }
    .toggle input { opacity: 0; width: 0; height: 0; }
    .toggle .slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background: #cbd5e1; border-radius: 26px; transition: 0.25s; }
    .toggle .slider:before { content: ''; position: absolute; height: 20px; width: 20px; left: 3px; bottom: 3px; background: white; border-radius: 50%; transition: 0.25s; box-shadow: 0 1px 3px rgba(0,0,0,0.15); }
    .toggle input:checked + .slider { background: #3b82f6; }
    .toggle input:checked + .slider:before { transform: translateX(22px); }
    .actions { display: flex; flex-direction: column; gap: 10px; }
    .btn { display: block; width: 100%; padding: 13px; border: none; border-radius: 10px; font-size: 15px; font-weight: 600; cursor: pointer; transition: all 0.2s; text-align: center; }
    .btn-primary { background: #3b82f6; color: white; }
    .btn-primary:hover { background: #2563eb; }
    .btn-primary:disabled { background: #93c5fd; cursor: not-allowed; }
    .btn-danger { background: #fee2e2; color: #dc2626; }
    .btn-danger:hover { background: #fecaca; }
    .divider { display: flex; align-items: center; gap: 12px; margin: 4px 0; }
    .divider span { font-size: 12px; color: #94a3b8; white-space: nowrap; }
    .divider hr { flex: 1; border: none; border-top: 1px solid #e2e8f0; }
    .success-msg { display: none; text-align: center; padding: 24px; }
    .success-msg.show { display: block; }
    .success-msg .icon { font-size: 48px; margin-bottom: 12px; }
    .success-msg h2 { font-size: 20px; color: #16a34a; margin-bottom: 8px; }
    .success-msg p { font-size: 14px; color: #64748b; }
    .form-content { }
    .form-content.hidden { display: none; }
    .error-msg { background: #fef2f2; color: #dc2626; padding: 10px 14px; border-radius: 8px; font-size: 13px; margin-bottom: 12px; display: none; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1>Email Preferences</h1>
      <p>Manage which emails you receive</p>
    </div>
    <div class="body">
      <div class="success-msg" id="successMsg">
        <div class="icon">&#10003;</div>
        <h2>Preferences Saved</h2>
        <p>Your email preferences have been updated successfully. You can close this page.</p>
      </div>
      <div class="form-content" id="formContent">
        <p class="greeting">Hi ${displayName.replace(/</g, '&lt;').replace(/>/g, '&gt;')}, choose which types of emails you'd like to receive:</p>
        ${highlightLabel ? `<div class="highlight-banner">This email was sent as <strong>${highlightLabel}</strong>. You can unsubscribe from this category below, or manage all your preferences.</div>` : ''}
        <div class="error-msg" id="errorMsg"></div>
        <div class="pref-group">
          <div class="pref-item">
            <div class="pref-info">
              <div class="pref-label">Marketing</div>
              <div class="pref-desc">Promotional offers, deals, and product announcements</div>
            </div>
            <label class="toggle"><input type="checkbox" id="pref_marketing" ${contact.prefMarketing ? 'checked' : ''}><span class="slider"></span></label>
          </div>
          <div class="pref-item">
            <div class="pref-info">
              <div class="pref-label">Customer Engagement</div>
              <div class="pref-desc">Birthday wishes, loyalty rewards, and personalized messages</div>
            </div>
            <label class="toggle"><input type="checkbox" id="pref_customer_engagement" ${contact.prefCustomerEngagement ? 'checked' : ''}><span class="slider"></span></label>
          </div>
          <div class="pref-item">
            <div class="pref-info">
              <div class="pref-label">Newsletters</div>
              <div class="pref-desc">Regular updates, news, and content digests</div>
            </div>
            <label class="toggle"><input type="checkbox" id="pref_newsletters" ${contact.prefNewsletters ? 'checked' : ''}><span class="slider"></span></label>
          </div>
          <div class="pref-item">
            <div class="pref-info">
              <div class="pref-label">Surveys &amp; Forms</div>
              <div class="pref-desc">Feedback requests, surveys, and form invitations</div>
            </div>
            <label class="toggle"><input type="checkbox" id="pref_surveys_forms" ${contact.prefSurveysForms ? 'checked' : ''}><span class="slider"></span></label>
          </div>
        </div>
        <div class="actions">
          <button class="btn btn-primary" id="saveBtn">Save Preferences</button>
          <div class="divider"><hr><span>or</span><hr></div>
          <button class="btn btn-danger" id="unsubAllBtn">Unsubscribe from All</button>
        </div>
      </div>
    </div>
  </div>
  <script>
    var TOKEN = ${JSON.stringify(token)};
    document.getElementById('saveBtn').addEventListener('click', function() {
      var btn = document.getElementById('saveBtn');
      btn.disabled = true;
      btn.textContent = 'Saving...';
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
          document.getElementById('successMsg').classList.add('show');
        } else {
          document.getElementById('errorMsg').textContent = data.error || 'Failed to save preferences.';
          document.getElementById('errorMsg').style.display = 'block';
          btn.disabled = false;
          btn.textContent = 'Save Preferences';
        }
      }).catch(function() {
        document.getElementById('errorMsg').textContent = 'Network error. Please try again.';
        document.getElementById('errorMsg').style.display = 'block';
        btn.disabled = false;
        btn.textContent = 'Save Preferences';
      });
    });
    document.getElementById('unsubAllBtn').addEventListener('click', function() {
      if (!confirm('Are you sure you want to unsubscribe from all emails?')) return;
      var btn = document.getElementById('unsubAllBtn');
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
          var msg = document.getElementById('successMsg');
          msg.querySelector('h2').textContent = 'Unsubscribed';
          msg.querySelector('p').textContent = 'You have been unsubscribed from all emails. You can close this page.';
          msg.classList.add('show');
        } else {
          document.getElementById('errorMsg').textContent = data.error || 'Failed to unsubscribe.';
          document.getElementById('errorMsg').style.display = 'block';
          btn.disabled = false;
          btn.textContent = 'Unsubscribe from All';
        }
      }).catch(function() {
        document.getElementById('errorMsg').textContent = 'Network error. Please try again.';
        document.getElementById('errorMsg').style.display = 'block';
        btn.disabled = false;
        btn.textContent = 'Unsubscribe from All';
      });
    });
  </script>
</body>
</html>`);
  } catch (error) {
    console.error('[EmailRoutes] Unsubscribe page failed:', error);
    return res.status(500).type('text/html').send('<html><body><h1>Error</h1><p>Failed to load preferences. Please try again later.</p></body></html>');
  }
});