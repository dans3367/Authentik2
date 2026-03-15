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
import { emailManagementRoutes } from "./routes/email";
import { newsletterRoutes } from "./routes/newsletterRoutes";
import { cardImageRoutes } from "./routes/cardImageRoutes";
import { newsletterImageRoutes } from "./routes/newsletterImageRoutes";
import { authenticateToken, requireTenant } from "./middleware/auth-middleware";

import { webhookRoutes } from "./routes/webhookRoutes";
import { devRoutes } from "./routes/devRoutes";
import { emailRoutes } from "./routes/emailRoutes";
import { userRoutes } from "./routes/userRoutes";
import { authRoutes } from "./routes/authRoutes";
import { twoFactorRoutes } from "./routes/twoFactorRoutes";
import { loginRoutes } from "./routes/loginRoutes";
import { getAuthSecret } from "./auth";
import { tenantLimitsRoutes } from "./routes/tenantLimitsRoutes";
import { promotionRoutes } from "./routes/promotionRoutes";
import customCardsRoutes from "./routes/customCardsRoutes";
import appointmentRoutes from "./routes/appointmentRoutes";
import appointmentRemindersRoutes from "./routes/appointmentRemindersRoutes";
import appointmentNotesRoutes from "./routes/appointmentNotesRoutes";
import appointmentConfirmationRoutes from "./routes/appointmentConfirmationRoutes";
import suppressionManagementRoutes from "./routes/suppressionManagementRoutes";
import aiRoutes from "./routes/aiRoutes";
import { templateRoutes } from "./routes/templateRoutes";
import { signupRoutes } from "./routes/signupRoutes";
import { tenantFixRoutes } from "./routes/tenantFixRoutes";
import { segmentListRoutes } from "./routes/segmentListRoutes";
import { activityRoutes } from "./routes/activityRoutes";
import { axiomActivityRoutes } from "./routes/axiomActivityRoutes";
import { accountUsageRoutes } from "./routes/accountUsageRoutes";
import { roleRoutes } from "./routes/roleRoutes";
import internalRoutes from "./routes/internalRoutes";
import { statsRoutes } from "./routes/statsRoutes";
import { newsletterReactionRoutes } from "./routes/newsletterReactionRoutes";
import { publicNewsletterRoutes } from "./routes/publicNewsletterRoutes";
import { analyticsRoutes } from "./routes/analyticsRoutes";

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
  app.use("/api/public/newsletters", publicNewsletterRoutes); // Public newsletter web viewing (blog format)
  app.use("/api/newsletter-reactions", newsletterReactionRoutes); // Public reaction endpoint + authenticated stats
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
  app.use("/api/newsletter-images", newsletterImageRoutes);
  app.use("/api/promotions", promotionRoutes);
  app.use("/api/custom-cards", customCardsRoutes);
  app.use("/api/appointments", appointmentRoutes);
  app.use("/api/appointment-reminders", appointmentRemindersRoutes);
  app.use("/api/appointment-notes", appointmentNotesRoutes);
  app.use("/api/ai", aiRoutes);
  app.use("/api/suppression", suppressionManagementRoutes);
  app.use("/api/templates", authenticateToken, requireTenant, templateRoutes);
  app.use("/api", segmentListRoutes);
  app.use("/api/activity-logs", authenticateToken, requireTenant, activityRoutes);
  app.use("/api/axiom-activity-logs", authenticateToken, requireTenant, axiomActivityRoutes);
  app.use("/api/account-usage", accountUsageRoutes);
  app.use("/api/stats", statsRoutes);
  app.use("/api/analytics", analyticsRoutes);

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


  app.use("/api/webhooks", webhookRoutes);
  if (process.env.NODE_ENV !== 'production') {
    app.use("/api/dev", devRoutes);
  }
  app.use("/api/email", emailRoutes);
  app.use("/api/users", userRoutes);
  app.use("/api/roles", roleRoutes);
  app.use("/api/2fa", twoFactorRoutes);
  app.use("/api/auth", authRateLimiter, loginRoutes);
  app.use("/api/tenant-limits", tenantLimitsRoutes);

  // Birthday test endpoint - sends a test birthday card via Trigger.dev + Resend
  // Business logic extracted to server/services/birthdayTestService.ts for testability
  app.post("/api/birthday-test", authenticateToken, async (req: any, res) => {
    try {
      const { sendBirthdayTestEmail } = await import('./services/birthdayTestService');

      const result = await sendBirthdayTestEmail(
        req.user.tenantId,
        req.user.id,
        req.body
      );

      if (!result.success) {
        const statusCode = result.errorCode === 'opted_out' ? 403 : 400;
        return res.status(statusCode).json(result);
      }

      res.json(result);
    } catch (error) {
      console.error('❌ [Birthday Test] Failed to send test birthday card:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Birthday unsubscribe/resubscribe - redirect to native unsubscribe preferences page
  // These were previously proxied to cardprocessor-go; now handled natively via /api/email/unsubscribe
  app.get("/api/unsubscribe/birthday", (req: any, res) => {
    const token = req.query.token as string;
    if (!token) {
      return res.status(400).type('text/html').send('<html><body><h1>Invalid request</h1><p>Missing token.</p></body></html>');
    }
    res.redirect(`/api/email/unsubscribe?token=${encodeURIComponent(token)}&type=customer_engagement`);
  });

  app.get("/api/resubscribe/birthday", (req: any, res) => {
    const token = req.query.token as string;
    if (!token) {
      return res.status(400).type('text/html').send('<html><body><h1>Invalid request</h1><p>Missing token.</p></body></html>');
    }
    res.redirect(`/api/email/unsubscribe?token=${encodeURIComponent(token)}&type=customer_engagement`);
  });

  // Generate external service token endpoint
  app.post("/api/external-token", authenticateToken, jwtTokenRateLimiter, async (req: any, res) => {
    try {
      // Use consistent auth secret (same as loginRoutes.ts)
      const jwtSecret = getAuthSecret();

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