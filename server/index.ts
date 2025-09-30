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
import { newsletterWorkerService } from "./services/NewsletterWorkerService";
import { birthdayWorkerService } from "./services/BirthdayWorkerService";

const app = express();

// Trust proxy for Replit environment - trust only the first proxy
app.set('trust proxy', 1);

// Security middleware
app.use(helmetMiddleware);

// Static CORS and security headers
app.use((req, res, next) => {
  const allowedOrigin = process.env.CORS_ORIGIN || '*';
  res.header('Access-Control-Allow-Origin', allowedOrigin);
  res.header('Vary', 'Origin');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Cache-Control, Pragma, Cookie, Set-Cookie');
  res.header('Access-Control-Allow-Credentials', 'true');

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
app.use(mongoSanitizer);

// Input sanitization
app.use(sanitizeMiddleware);

// Better Auth middleware for authentication
// Note: better-auth uses toNodeHandler for Express integration
// Only handle standard better-auth routes, exclude custom routes like verify-login
app.all("/api/auth/*", (req, res, next) => {
  // Skip custom auth routes that should be handled by our custom routes
  const customRoutes = ['verify-login', 'verify-2fa', 'check-2fa-requirement', 'verify-session-2fa', '2fa-status'];
  const path = req.path.replace('/api/auth/', '');

  if (customRoutes.includes(path)) {
    return next();
  }

  // Handle with Better Auth
  const authHandler = toNodeHandler(auth);
  return authHandler(req, res);
});

// Body parsing with size limits - applied after auth handler
app.use(express.json(requestSizeLimiter.json));
app.use(express.urlencoded(requestSizeLimiter.urlencoded));

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

  // Initialize Newsletter Worker Service
  try {
    serverLogger.info('🏭 Starting Newsletter Worker Service...');
    await newsletterWorkerService.start();
    serverLogger.info('✅ Newsletter Worker Service started');
  } catch (error) {
    serverLogger.error("Failed to initialize Newsletter Worker Service:", error);
    // Don't exit - continue without worker service
  }

  // Initialize Birthday Worker Service
  try {
    serverLogger.info('🎂 Starting Birthday Worker Service...');
    birthdayWorkerService.start();
    serverLogger.info('✅ Birthday Worker Service started');
  } catch (error) {
    serverLogger.error("Failed to initialize Birthday Worker Service:", error);
    // Don't exit - continue without worker service
  }

  // Check server-node connectivity
  serverLogger.info('🔄 Checking service connectivity...');
  try {
    serverLogger.info('📊 Service Architecture:');
    serverLogger.info('   🌐 Main Server: localhost:5000 (Authentication & Proxy)');
    serverLogger.info('   🤖 server-node: localhost:3502 (Temporal Client)');
    serverLogger.info('   ⚡ temporal-server: localhost:50051 (GRPC Bridge)');
    serverLogger.info('   🎂 cardprocessor-go: localhost:5004 (Birthday & Unsubscribe)');
    
    // Test connectivity to server-node
    try {
      const response = await fetch('http://localhost:3502/health');
      if (response.ok) {
        serverLogger.info('   ✅ server-node: Connected');
      } else {
        serverLogger.warn('   ⚠️  server-node: Responding but not healthy');
      }
    } catch (error) {
      serverLogger.warn('   ❌ server-node: Disconnected (will proxy anyway)');
    }
  } catch (error) {
    serverLogger.info('   🔧 Continuing with proxy setup...');
  }

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
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  server.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
    },
  );
})();
