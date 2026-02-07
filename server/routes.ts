import type { Express } from "express";
import { createServer, type Server } from "http";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import cookieParser from "cookie-parser";

// Import route modules
// Note: authRoutes removed - better-auth handles authentication now
import { adminRoutes } from "./routes/adminRoutes";
import { formsRoutes } from "./routes/formsRoutes";
import { formTagsRoutes } from "./routes/formTagsRoutes";
import { subscriptionRoutes } from "./routes/subscriptionRoutes";
import { companyRoutes } from "./routes/companyRoutes";
import { shopsRoutes } from "./routes/shopsRoutes";
import { emailManagementRoutes } from "./routes/emailManagementRoutes";
import { newsletterRoutes } from "./routes/newsletterRoutes";
import { cardImageRoutes } from "./routes/cardImageRoutes";
import { authenticateToken, requireTenant } from "./middleware/auth-middleware";
import { campaignRoutes } from "./routes/campaignRoutes";
import { webhookRoutes } from "./routes/webhookRoutes";
import { devRoutes } from "./routes/devRoutes";
import { emailRoutes } from "./routes/emailRoutes";
import { userRoutes } from "./routes/userRoutes";
import { authRoutes } from "./routes/authRoutes";
import { twoFactorRoutes } from "./routes/twoFactorRoutes";
import { loginRoutes } from "./routes/loginRoutes";
import { tenantLimitsRoutes } from "./routes/tenantLimitsRoutes";
import { promotionRoutes } from "./routes/promotionRoutes";
import customCardsRoutes from "./routes/customCardsRoutes";
import appointmentRoutes from "./routes/appointmentRoutes";
import appointmentRemindersRoutes from "./routes/appointmentRemindersRoutes";
import appointmentNotesRoutes from "./routes/appointmentNotesRoutes";
import appointmentConfirmationRoutes from "./routes/appointmentConfirmationRoutes";
import newsletterWorkerRoutes from "./routes/newsletterWorkerRoutes";
import suppressionManagementRoutes from "./routes/suppressionManagementRoutes";
import aiRoutes from "./routes/aiRoutes";
import { birthdayWorkerRoutes } from "./routes/birthdayWorkerRoutes";
import { templateRoutes } from "./routes/templateRoutes";
import { signupRoutes } from "./routes/signupRoutes";
import { tenantFixRoutes } from "./routes/tenantFixRoutes";
import { segmentListRoutes } from "./routes/segmentListRoutes";
import { activityRoutes } from "./routes/activityRoutes";
import { accountUsageRoutes } from "./routes/accountUsageRoutes";
import internalRoutes from "./routes/internalRoutes";

// Import middleware
import { authRateLimiter, apiRateLimiter, jwtTokenRateLimiter } from "./middleware/security";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export async function registerRoutes(app: Express): Promise<Server> {
  // Cookie parser middleware
  app.use(cookieParser());

  // Rate limiting
  // Note: Auth rate limiting handled by better-auth
  app.use("/api", apiRateLimiter);

  // API Routes
  // Note: Auth routes handled by better-auth middleware
  // Internal routes (authenticated via internal service middleware)
  app.use("/api/internal", internalRoutes);
  
  // Public routes (no authentication required)
  app.use("/api/appointments", appointmentConfirmationRoutes); // Public appointment confirmation/decline

  app.use("/api/signup", signupRoutes); // Signup helper endpoints
  app.use("/api/tenant-fix", tenantFixRoutes); // Admin tools to fix tenant assignments
  app.use("/api/admin", adminRoutes);
  app.use("/api/user", authRoutes); // User-facing session endpoints
  app.use("/api/forms", formsRoutes);
  app.use("/api/form-tags", formTagsRoutes);
  app.use("/api/subscription", subscriptionRoutes);
  app.use("/api/company", companyRoutes);
  app.use("/api/shops", shopsRoutes);
  app.use("/api", emailManagementRoutes);
  app.use("/api/newsletters", newsletterRoutes);
  app.use("/api/card-images", cardImageRoutes);
  app.use("/api/promotions", promotionRoutes);
  app.use("/api/custom-cards", customCardsRoutes);
  app.use("/api/appointments", appointmentRoutes);
  app.use("/api/appointment-reminders", appointmentRemindersRoutes);
  app.use("/api/appointment-notes", appointmentNotesRoutes);
  app.use("/api/newsletter-worker", newsletterWorkerRoutes);
  app.use("/api/birthday-worker", birthdayWorkerRoutes);
  app.use("/api/ai", aiRoutes);
  app.use("/api/suppression", suppressionManagementRoutes);
  app.use("/api/templates", authenticateToken, requireTenant, templateRoutes);
  app.use("/api", segmentListRoutes);
  app.use("/api/activity-logs", authenticateToken, requireTenant, activityRoutes);
  app.use("/api/account-usage", accountUsageRoutes);

  // Newsletter stats endpoint
  app.get("/api/newsletter-stats", authenticateToken, requireTenant, async (req: any, res) => {
    try {
      const { db } = await import('./db');
      const { newsletters } = await import('@shared/schema');
      const { sql } = await import('drizzle-orm');

      const stats = await db.select({
        totalNewsletters: sql<number>`count(*)`,
        draftNewsletters: sql<number>`count(*) filter (where status = 'draft')`,
        scheduledNewsletters: sql<number>`count(*) filter (where status = 'scheduled')`,
        sentNewsletters: sql<number>`count(*) filter (where status = 'sent')`,
        newslettersThisMonth: sql<number>`count(*) filter (where created_at >= current_date - interval '30 days')`,
      }).from(newsletters).where(sql`${newsletters.tenantId} = ${req.user.tenantId}`);

      res.json(stats[0]);
    } catch (error) {
      console.error('Get newsletter stats error:', error);
      res.status(500).json({ message: 'Failed to get newsletter statistics' });
    }
  });

  // Promotion stats endpoint
  app.get("/api/promotion-stats", authenticateToken, requireTenant, async (req: any, res) => {
    try {
      const { storage } = await import('./storage');
      const stats = await storage.getPromotionStats(req.user.tenantId);
      res.json(stats);
    } catch (error) {
      console.error('Get promotion stats error:', error);
      res.status(500).json({ message: 'Failed to get promotion statistics' });
    }
  });

  app.use("/api/campaigns", campaignRoutes);
  app.use("/api/webhooks", webhookRoutes);
  app.use("/api/dev", devRoutes);
  app.use("/api/email", emailRoutes);
  app.use("/api/users", userRoutes);
  app.use("/api/2fa", twoFactorRoutes);
  app.use("/api/auth", loginRoutes);
  app.use("/api/tenant-limits", tenantLimitsRoutes);

  // Temporal workflow endpoints - proxy to server-node
  app.post("/api/temporal/clear-workflows", authenticateToken, async (req: any, res) => {
    try {
      console.log('🧹 [Temporal Proxy] Forwarding workflow cleanup request to server-node for tenant:', req.user.tenantId);

      // Forward request to server-node with authentication
      const response = await fetch('http://localhost:3502/api/temporal/clear-workflows', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': req.headers.authorization || '',
        },
        body: JSON.stringify({
          tenantId: req.user.tenantId,
          userId: req.user.id
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ [Temporal Proxy] server-node returned error:', response.status, errorText);
        return res.status(response.status).json({
          success: false,
          message: 'server-node request failed',
          error: errorText
        });
      }

      const result = await response.json();
      console.log('✅ [Temporal Proxy] server-node response:', result);
      res.json(result);
    } catch (error) {
      console.error('❌ [Temporal Proxy] Failed to communicate with server-node:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to communicate with temporal service',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Birthday test endpoint - sends a test birthday card via Trigger.io + Resend
  app.post("/api/birthday-test", authenticateToken, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      const { userEmail, userFirstName, userLastName, emailTemplate, customMessage, customThemeData, senderName, promotionId, splitPromotionalEmail } = req.body;

      console.log('🎂 [Birthday Test] Sending test birthday card to:', userEmail, 'for tenant:', tenantId);

      if (!userEmail) {
        return res.status(400).json({ success: false, error: 'userEmail is required' });
      }

      // Fetch birthday settings for this tenant
      const { db } = await import('./db');
      const { birthdaySettings, companies, promotions, emailContacts, unsubscribeTokens } = await import('@shared/schema');
      const { eq, and, sql } = await import('drizzle-orm');
      const crypto = await import('crypto');

      const settings = await db.query.birthdaySettings.findFirst({
        where: eq(birthdaySettings.tenantId, tenantId),
        with: { promotion: true },
      });

      // Fetch company info for branding
      const company = await db.query.companies.findFirst({
        where: and(eq(companies.tenantId, tenantId), eq(companies.isActive, true)),
      });

      const resolvedTemplate = emailTemplate || settings?.emailTemplate || 'default';
      const resolvedMessage = customMessage || settings?.customMessage || 'Wishing you a wonderful birthday!';
      const resolvedCustomThemeData = customThemeData || settings?.customThemeData || null;
      const resolvedSenderName = senderName || settings?.senderName || company?.name || 'Your Team';
      const companyName = company?.name || resolvedSenderName;

      // Build recipient name
      const recipientName = userFirstName
        ? `${userFirstName}${userLastName ? ` ${userLastName}` : ''}`
        : userEmail.split('@')[0];

      // Look up contact and check Customer Engagement opt-out
      let unsubscribeToken: string | undefined;
      try {
        const contact = await db.query.emailContacts.findFirst({
          where: and(eq(emailContacts.email, userEmail), eq(emailContacts.tenantId, tenantId)),
          columns: { id: true, prefCustomerEngagement: true },
        });

        if (contact && contact.prefCustomerEngagement === false) {
          console.log(`🚫 [Birthday Test] Contact ${userEmail} has opted out of Customer Engagement emails`);
          return res.status(403).json({
            success: false,
            error: 'This contact has opted out of Customer Engagement emails. The birthday card was not sent.',
          });
        }

        if (contact) {
          // Look for existing unused token
          let existingToken = await db.query.unsubscribeTokens.findFirst({
            where: and(
              eq(unsubscribeTokens.tenantId, tenantId),
              eq(unsubscribeTokens.contactId, contact.id),
              sql`${unsubscribeTokens.usedAt} IS NULL`
            ),
          });

          if (!existingToken) {
            const token = crypto.randomBytes(24).toString('base64url');
            const created = await db.insert(unsubscribeTokens).values({
              tenantId,
              contactId: contact.id,
              token,
            }).returning();
            existingToken = created[0];
          }

          unsubscribeToken = existingToken?.token;
          console.log(`🔗 [Birthday Test] Generated unsubscribe token for ${userEmail}`);
        } else {
          console.log(`⚠️ [Birthday Test] No contact found for ${userEmail}, skipping unsubscribe token`);
        }
      } catch (tokenError) {
        console.warn(`⚠️ [Birthday Test] Error generating unsubscribe token:`, tokenError);
      }

      // Import the renderBirthdayTemplate helper from emailManagementRoutes
      const { renderBirthdayTemplate } = await import('./routes/emailManagementRoutes');

      const htmlContent = renderBirthdayTemplate(resolvedTemplate as any, {
        recipientName,
        message: resolvedMessage,
        brandName: companyName,
        customThemeData: resolvedCustomThemeData ? (typeof resolvedCustomThemeData === 'string' ? JSON.parse(resolvedCustomThemeData) : resolvedCustomThemeData) : null,
        senderName: resolvedSenderName,
        promotionContent: settings?.promotion?.content,
        promotionTitle: settings?.promotion?.title,
        promotionDescription: settings?.promotion?.description,
        unsubscribeToken,
      });

      // Build unsubscribe URL for List-Unsubscribe header
      const baseUrl = process.env.APP_URL || 'http://localhost:5000';
      const unsubscribeUrl = unsubscribeToken
        ? `${baseUrl}/api/email/unsubscribe?token=${encodeURIComponent(unsubscribeToken)}&type=customer_engagement`
        : undefined;

      // Send via Trigger.io sendEmailTask (same path as direct email flow)
      const { tasks } = await import('@trigger.dev/sdk/v3');
      const subject = `🎉 Happy Birthday ${recipientName}! (Test)`;

      const handle = await tasks.trigger('send-email', {
        to: userEmail,
        subject,
        html: htmlContent,
        from: process.env.EMAIL_FROM || 'admin@zendwise.com',
        headers: unsubscribeUrl ? {
          'List-Unsubscribe': `<${unsubscribeUrl}>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        } : undefined,
        metadata: {
          type: 'birthday-card-test',
          tenantId,
          userId: req.user.id,
          test: true,
        },
      });

      console.log(`✅ [Birthday Test] Triggered send-email task, runId: ${handle.id}`);

      res.json({
        success: true,
        message: 'Test birthday card sent successfully',
        runId: handle.id,
        recipient: userEmail,
      });
    } catch (error) {
      console.error('❌ [Birthday Test] Failed to send test birthday card:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Unsubscribe endpoints - proxy to cardprocessor-go main server (port 5004)
  // These routes are public (no authentication) for customer-facing unsubscribe functionality
  app.get("/api/unsubscribe/birthday", async (req: any, res) => {
    try {
      console.log('🔗 [Unsubscribe Proxy] Forwarding GET request to cardprocessor-go:5004, token:', req.query.token?.substring(0, 10) + '...');

      // Build query string
      const queryParams = new URLSearchParams(req.query as any).toString();
      const url = `http://localhost:5004/api/unsubscribe/birthday${queryParams ? '?' + queryParams : ''}`;

      // Forward request to cardprocessor-go server
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'text/html',
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ [Unsubscribe Proxy] cardprocessor-go returned error:', response.status, errorText);
        return res.status(response.status).send(errorText);
      }

      const html = await response.text();
      res.set('Content-Type', 'text/html');
      res.send(html);
    } catch (error) {
      console.error('❌ [Unsubscribe Proxy] Failed to communicate with cardprocessor-go:', error);
      res.status(500).send('<html><body><h1>Service Temporarily Unavailable</h1><p>Unable to process unsubscribe request. Please try again later.</p></body></html>');
    }
  });

  app.post("/api/unsubscribe/birthday", async (req: any, res) => {
    try {
      console.log('🔗 [Unsubscribe Proxy] Forwarding POST request to cardprocessor-go:5004');

      // Forward request to cardprocessor-go server
      const response = await fetch('http://localhost:5004/api/unsubscribe/birthday', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams(req.body).toString()
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ [Unsubscribe Proxy] cardprocessor-go returned error:', response.status, errorText);
        return res.status(response.status).send(errorText);
      }

      const html = await response.text();
      console.log('✅ [Unsubscribe Proxy] Successfully processed unsubscribe request');
      res.set('Content-Type', 'text/html');
      res.send(html);
    } catch (error) {
      console.error('❌ [Unsubscribe Proxy] Failed to communicate with cardprocessor-go:', error);
      res.status(500).send('<html><body><h1>Service Temporarily Unavailable</h1><p>Unable to process unsubscribe request. Please try again later.</p></body></html>');
    }
  });

  // Resubscribe endpoint - proxy to cardprocessor-go main server (port 5004)
  app.get("/api/resubscribe/birthday", async (req: any, res) => {
    try {
      console.log("🔗 [Resubscribe Proxy] Forwarding GET request to cardprocessor-go:5004, token:", req.query.token?.substring(0, 10) + "...");

      // Build query string
      const queryParams = new URLSearchParams(req.query as any).toString();
      const url = `http://localhost:5004/api/resubscribe/birthday${queryParams ? "?" + queryParams : ""}`;

      // Forward request to cardprocessor-go server
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "User-Agent": "birthday-service-proxy",
        },
      });

      // Forward the HTML response
      const html = await response.text();
      res.status(response.status).type("text/html").send(html);

    } catch (error) {
      console.error("❌ [Resubscribe Proxy] Failed to communicate with cardprocessor-go:", error);
      res.status(500).send("<html><body><h1>Service Temporarily Unavailable</h1><p>Unable to process resubscribe request. Please try again later.</p></body></html>");
    }
  });

  // Email tracking endpoints - DISABLED (legacy server-node service no longer exists)
  // Email tracking is now handled directly in the database via email_sends, email_events, and email_content tables
  // Data is tracked automatically by cardprocessor-go when emails are sent
  // To query email tracking data, query these tables directly or create new API endpoints

  app.get("/api/email-tracking", authenticateToken, async (req: any, res) => {
    res.status(501).json({
      success: false,
      message: 'Email tracking endpoints are disabled. Use database queries on email_sends, email_events, and email_content tables instead.',
      note: 'Legacy server-node service has been replaced. Email tracking is now in the database.'
    });
  });

  app.post("/api/email-tracking", authenticateToken, async (req: any, res) => {
    res.status(501).json({
      success: false,
      message: 'Email tracking endpoints are disabled. Email tracking is handled automatically by cardprocessor-go.',
      note: 'Legacy server-node service has been replaced. Check email_sends table for tracking data.'
    });
  });

  // Legacy routes for backward compatibility (if needed)
  // These can be removed once all clients are updated
  // Note: Auth routes removed - better-auth handles authentication

  // Generate external service token endpoint
  app.post("/api/external-token", authenticateToken, jwtTokenRateLimiter, async (req: any, res) => {
    try {
      // Validate JWT secret exists - CRITICAL SECURITY FIX
      const jwtSecret = process.env.JWT_SECRET;
      if (!jwtSecret) {
        console.error('❌ [Security] JWT_SECRET environment variable is not set');
        return res.status(500).json({ message: 'Server configuration error' });
      }

      const jwt = await import('jsonwebtoken');

      // Generate token with minimal claims and shorter expiration
      const token = jwt.default.sign(
        {
          sub: req.user.id,           // Standard 'subject' claim
          tenant: req.user.tenantId,  // Only essential data
          scope: 'external-service',  // Specific scope
          iat: Math.floor(Date.now() / 1000)
        },
        jwtSecret,
        {
          expiresIn: '15m',          // Reduced from 1 hour to 15 minutes
          algorithm: 'HS256',
          issuer: 'authentik-api',
          audience: 'external-services'
        }
      );

      // Audit log for security monitoring
      console.log('🔒 [Security] External JWT token generated:', {
        userId: req.user.id,
        userAgent: req.get('User-Agent'),
        ip: req.ip || req.connection.remoteAddress,
        timestamp: new Date().toISOString()
      });

      res.json({
        token,
        expiresIn: 900, // 15 minutes in seconds
        tokenType: 'Bearer'
      });
    } catch (error) {
      console.error('External token generation error:', error);
      res.status(500).json({ message: 'Failed to generate external service token' });
    }
  });

  // Health check endpoint
  app.get("/api/health", (req, res) => {
    res.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || "1.0.0",
    });
  });

  // API documentation endpoint
  app.get("/api/docs", (req, res) => {
    res.json({
      message: "Authentik API Documentation",
      version: "1.0.0",
      endpoints: {
        user: "/api/user/* (sessions, logout-all)",
        admin: "/api/admin/*",
        forms: "/api/forms/*",
        subscription: "/api/subscription/*",
        company: "/api/company/*",
        shops: "/api/shops/*",
        emailManagement: "/api/email-contacts/*, /api/email-lists/*, /api/bounced-emails/*, /api/contact-tags/*",
        newsletters: "/api/newsletters/*",
        campaigns: "/api/campaigns/*",
        webhooks: "/api/webhooks/*",
        dev: "/api/dev/*",
        email: "/api/email/*",
        users: "/api/users/*",
        twoFactor: "/api/2fa/*",
        templates: "/api/templates/* (CRUD operations with tenant filtering)",
      },
      documentation: "https://docs.zendwise.work/api",
    });
  });

  // Create HTTP server
  const server = createServer(app);

  return server;
}