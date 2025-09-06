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
import { subscriptionRoutes } from "./routes/subscriptionRoutes";
import { companyRoutes } from "./routes/companyRoutes";
import { shopsRoutes } from "./routes/shopsRoutes";
import { emailManagementRoutes } from "./routes/emailManagementRoutes";
import { newsletterRoutes } from "./routes/newsletterRoutes";
import { authenticateToken, requireTenant } from "./middleware/auth-middleware";
import { campaignRoutes } from "./routes/campaignRoutes";
import { webhookRoutes } from "./routes/webhookRoutes";
import { devRoutes } from "./routes/devRoutes";
import { emailRoutes } from "./routes/emailRoutes";
import { userRoutes } from "./routes/userRoutes";
import { authRoutes } from "./routes/authRoutes";

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
  app.use("/api/admin", adminRoutes);
  app.use("/api/user", authRoutes); // User-facing session endpoints
  app.use("/api/forms", formsRoutes);
  app.use("/api/subscription", subscriptionRoutes);
  app.use("/api/company", companyRoutes);
  app.use("/api/shops", shopsRoutes);
  app.use("/api", emailManagementRoutes);
  app.use("/api/newsletters", newsletterRoutes);

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

  app.use("/api/campaigns", campaignRoutes);
  app.use("/api/webhooks", webhookRoutes);
  app.use("/api/dev", devRoutes);
  app.use("/api/email", emailRoutes);
  app.use("/api/users", userRoutes);

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

  // Local email test endpoint (fallback when Go server is unavailable)
  app.post("/api/email-test/send", authenticateToken, async (req: any, res) => {
    try {
      const { recipient, subject, content, templateType, priority } = req.body;
      
      // Simulate email sending locally
      const emailId = `email-${Date.now()}`;
      
      console.log('📧 [Email Test] Processing email locally:', {
        emailId,
        recipient,
        subject,
        user: req.user.email
      });
      
      // You can integrate with your actual email service here
      // For now, just return a success response
      res.json({
        id: emailId,
        status: 'queued',
        message: 'Email queued for sending (local processing)',
        recipient,
        subject,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Email test error:', error);
      res.status(500).json({ message: 'Failed to process email' });
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
      },
      documentation: "https://docs.authentik.com/api",
    });
  });

  // Create HTTP server
  const server = createServer(app);

  return server;
}