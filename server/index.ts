// Load environment variables first
import "./config";

import express, { type Request, Response, NextFunction } from "express";
import type { Server } from "http";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { initializeDatabase } from "./init-db";
import {
  helmetMiddleware,
  generalRateLimiter,
  mongoSanitizer,
  sanitizeMiddleware,
  requestSizeLimiter
} from "./middleware/security";
import { auth } from "./auth";
import { toNodeHandler } from "better-auth/node";
import { serverLogger } from "./logger";

const app = express();

// Disable ETag generation to avoid 304 responses for API JSON
app.set('etag', false);

// Trust proxy for Replit environment - trust only the first proxy
app.set('trust proxy', 1);

// Security middleware
app.use(helmetMiddleware);

// Static CORS and security headers
app.use((req, res, next) => {
  const origin = req.headers.origin;
  // Build list of allowed origins from CORS_ORIGIN (comma-separated) and FRONTEND_URL
  const corsOriginEnv = process.env.CORS_ORIGIN || '';
  const frontendUrl = process.env.FRONTEND_URL || '';
  const allowedOrigins = new Set<string>();
  
  // Add explicitly configured origins (comma-separated)
  if (corsOriginEnv && corsOriginEnv !== '*') {
    corsOriginEnv.split(',').map(o => o.trim()).filter(Boolean).forEach(o => allowedOrigins.add(o));
  }
  // Add frontend URL as allowed origin
  if (frontendUrl) {
    allowedOrigins.add(frontendUrl);
  }
  // Add BASE_URL if configured
  if (process.env.BASE_URL) {
    allowedOrigins.add(process.env.BASE_URL);
  }

  // Check if origin is allowed
  let allowedOrigin: string | null = null;
  
  if (origin) {
    // Check explicit allowlist first
    if (allowedOrigins.has(origin)) {
      allowedOrigin = origin;
    }
    // Allow localhost/127.0.0.1 in development only
    else if (process.env.NODE_ENV === 'development' && (
      origin.startsWith('http://localhost:') ||
      origin.startsWith('http://127.0.0.1:') ||
      origin.startsWith('https://localhost:') ||
      origin.startsWith('https://127.0.0.1:')
    )) {
      allowedOrigin = origin;
    }
  }

  // Only set CORS headers if origin is allowed
  if (allowedOrigin) {
    res.header('Access-Control-Allow-Origin', allowedOrigin);
    res.header('Access-Control-Allow-Credentials', 'true');
  }
  // Always set Vary header for proper caching
  res.header('Vary', 'Origin');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Cache-Control, Pragma, Cookie, Set-Cookie, X-Internal-Service');

  // Keep existing security headers (static)
  res.header('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  res.header('Cross-Origin-Embedder-Policy', 'unsafe-none');
  res.header('X-Frame-Options', 'SAMEORIGIN');
  res.header('X-Content-Type-Options', 'nosniff');
  res.header('Referrer-Policy', 'strict-origin-when-cross-origin');

  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }

  next();
});

app.use(generalRateLimiter);
// Skip mongo sanitizer for webhook routes to avoid mangling external payloads
app.use((req, res, next) => {
  if (req.path.startsWith('/api/webhooks')) return next();
  mongoSanitizer(req, res, next);
});

// Input sanitization — skip webhook routes to avoid corrupting external payloads
app.use((req, res, next) => {
  if (req.path.startsWith('/api/webhooks')) return next();
  sanitizeMiddleware(req, res, next);
});

// Better Auth middleware for authentication
// Note: better-auth uses toNodeHandler for Express integration
// Only handle standard better-auth routes, exclude custom routes like verify-login
app.all("/api/auth/*", (req, res, next) => {
  // Skip custom auth routes that should be handled by our custom routes
  const customRoutes = ['verify-login', 'verify-2fa', 'check-2fa-requirement', 'verify-session-2fa', '2fa-status', 'verify-email', 'resend-verification', 'change-email-unverified', 'profile', 'avatar'];
  const path = req.path.replace('/api/auth/', '');

  if (customRoutes.includes(path)) {
    return next();
  }

  // Handle with Better Auth
  const authHandler = toNodeHandler(auth);
  return authHandler(req, res);
});

// Stripe webhook needs raw body for signature verification — must come before express.json()
app.use('/api/subscription/webhook', express.raw({ type: 'application/json', limit: '1mb' }));

// Body parsing with size limits - applied after auth handler
app.use(express.json(requestSizeLimiter.json));
app.use(express.urlencoded(requestSizeLimiter.urlencoded));
// AWS SNS sends POST with Content-Type: text/plain — parse it as text so we can JSON.parse in the handler
app.use('/api/webhooks', express.text({ type: 'text/plain', limit: '1mb' }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Initialize database first
  try {
    await initializeDatabase();
  } catch (error) {
    console.error("Failed to initialize database:", error);
    process.exit(1);
  }

  // Newsletter Worker Service - DISABLED
  // Workers are now handled by cardprocessor-go on port 5004
  // Uncomment below to re-enable if needed
  /*
  try {
    serverLogger.info('🏭 Starting Newsletter Worker Service...');
    await newsletterWorkerService.start();
    serverLogger.info('✅ Newsletter Worker Service started');
  } catch (error) {
    serverLogger.error("Failed to initialize Newsletter Worker Service:", error);
    // Don't exit - continue without worker service
  }
  */
  serverLogger.info('🚫 Newsletter Worker Service: DISABLED (handled by cardprocessor-go)');

  // Birthday Worker Service - DISABLED
  // Workers are now handled by cardprocessor-go on port 5004
  // Uncomment below to re-enable if needed
  /*
  try {
    serverLogger.info('🎂 Starting Birthday Worker Service...');
    birthdayWorkerService.start();
    serverLogger.info('✅ Birthday Worker Service started');
  } catch (error) {
    serverLogger.error("Failed to initialize Birthday Worker Service:", error);
    // Don't exit - continue without worker service
  }
  */
  serverLogger.info('🚫 Birthday Worker Service: DISABLED (handled by cardprocessor-go)');

  // Appointment Reminder Worker - handled by Trigger.dev (src/trigger/reminders.ts)
  serverLogger.info('🚫 Appointment Reminder Worker: handled by Trigger.dev');

  // Display service architecture
  serverLogger.info('🔄 Service Architecture:');
  serverLogger.info('   🌐 Main Server: localhost:5002 (Authentication & API)');
  serverLogger.info('   🎂 cardprocessor-go: localhost:5004 (Birthday Cards, Email Tracking & Unsubscribe)');
  serverLogger.info('   📝 Form Server: localhost:3004 (Form Serving)');
  serverLogger.info('   🪝 Webhook Server: localhost:3505 (Webhook Handling)');
  serverLogger.info('   ⚡ Temporal Server: localhost:50051 (GRPC Bridge - Optional)');
  serverLogger.info('');
  serverLogger.info('📊 Email Tracking: Handled automatically by cardprocessor-go → Database');
  serverLogger.info('   Tables: email_sends, email_events, email_content');

  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    serverLogger.error('Server error:', err);
    res.status(status).json({ message });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5002 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5002", 10);
  server.listen(port, "0.0.0.0", () => {
    log(`serving on port ${port}`);
  });
})();
