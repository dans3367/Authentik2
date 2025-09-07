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

const app = express();

// Trust proxy for Replit environment - trust only the first proxy
app.set('trust proxy', 1);

// Security middleware
app.use(helmetMiddleware);

// Custom CORS and security headers for trusted domains
app.use((req, res, next) => {
  const origin = req.get('Origin');
  const host = req.get('Host');
  
  // List of trusted domains
  const trustedDomains = [
    'weby.zendwise.work',
    'websy.zendwise.work',
    'localhost',
    '127.0.0.1'
  ];
  
  // Check if the origin or host is trusted
  const isTrustedDomain = trustedDomains.some(domain => 
    origin?.includes(domain) || host?.includes(domain)
  );
  
  if (isTrustedDomain) {
    // Set CORS headers for trusted domains
    res.header('Access-Control-Allow-Origin', origin || '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Cache-Control, Pragma');
    res.header('Access-Control-Allow-Credentials', 'true');
    
    // Set Cross-Origin-Opener-Policy to allow trusted domains
    res.header('Cross-Origin-Opener-Policy', 'unsafe-none');
    res.header('Cross-Origin-Embedder-Policy', 'unsafe-none');
    
    // Additional security headers for trusted domains
    res.header('X-Frame-Options', 'SAMEORIGIN');
    res.header('X-Content-Type-Options', 'nosniff');
    res.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  }
  
  // Handle preflight requests
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

  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error('Server error:', err);
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
  // Other ports are firewalled. Default to 3500 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "3500", 10);
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
