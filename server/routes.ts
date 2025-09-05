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
import { campaignRoutes } from "./routes/campaignRoutes";
import { webhookRoutes } from "./routes/webhookRoutes";
import { devRoutes } from "./routes/devRoutes";
import { emailRoutes } from "./routes/emailRoutes";
import { userRoutes } from "./routes/userRoutes";
import { authRoutes } from "./routes/authRoutes";

// Import middleware
import { authRateLimiter, apiRateLimiter } from "./middleware/security";

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
  app.use("/api/campaigns", campaignRoutes);
  app.use("/api/webhooks", webhookRoutes);
  app.use("/api/dev", devRoutes);
  app.use("/api/email", emailRoutes);
  app.use("/api/users", userRoutes);

  // Legacy routes for backward compatibility (if needed)
  // These can be removed once all clients are updated
  // Note: Auth routes removed - better-auth handles authentication

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