import helmet from "helmet";
import rateLimit from "express-rate-limit";
import mongoSanitize from "express-mongo-sanitize";
import xss from "xss";
import { validationResult, ValidationChain } from "express-validator";
import { Request, Response, NextFunction } from "express";

// Configure Helmet for security headers
export const helmetMiddleware = helmet({
  contentSecurityPolicy: process.env.NODE_ENV === 'development' ? {
    // More permissive CSP for development to allow external access
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://js.stripe.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:", "http:"],
      connectSrc: [
        "'self'",
        "https://api.stripe.com",
        "https://tenginex.zendwise.work",
        "https://tenginex.zendwise.work/*",
        "https://*.zendwise.work",
        "https://*.zendwise.work/*",
        "ws:",
        "wss:",
        "http:",
        "https:",
        "http://*:*",
        "https://*:*",
        "http://localhost:*",
        "https://localhost:*",
        "https://*.replit.dev",
        "https://*.repl.co"
      ],
      frameSrc: ["'self'", "https://js.stripe.com", "https://hooks.stripe.com"],
      // Explicitly disable upgrade-insecure-requests in development
      upgradeInsecureRequests: null,
    },
  } : {
    // Production CSP with stricter rules
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://js.stripe.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: [
        "'self'",
        "https://api.stripe.com",
        "https://tenginex.zendwise.work",
        "https://tenginex.zendwise.work/*",
        "https://*.zendwise.work",
        "https://*.zendwise.work/*",
        "ws:",
        "wss:",
        "http://localhost:*",
        "https://localhost:*",
        "https://*.replit.dev",
        "https://*.repl.co"
      ],
      frameSrc: ["'self'", "https://js.stripe.com", "https://hooks.stripe.com"],
      upgradeInsecureRequests: [],
    },
  },
  crossOriginEmbedderPolicy: false,
  // Disable HSTS in development to prevent HTTPS enforcement
  hsts: process.env.NODE_ENV === 'production',
});

// Rate limiting configurations
export const createRateLimiter = (options: {
  windowMs?: number;
  max?: number;
  message?: string;
  skipSuccessfulRequests?: boolean;
}) => {
  // Allow disabling rate limiting in development
  if (process.env.DISABLE_RATE_LIMITING === 'true') {
    return (req: any, res: any, next: any) => next();
  }
  
  return rateLimit({
    windowMs: options.windowMs || 15 * 60 * 1000, // 15 minutes default
    max: options.max || 100, // limit each IP to 100 requests per windowMs
    message: options.message || "Too many requests from this IP, please try again later.",
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: options.skipSuccessfulRequests || false,
  });
};

// Default rate limiters - RELAXED FOR DEBUGGING
export const generalRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Increased from 100 to 1000 for debugging
});

export const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // Increased from 5 to 50 for debugging
  message: "Too many authentication attempts, please try again later.",
  skipSuccessfulRequests: true,
});

export const apiRateLimiter = createRateLimiter({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 300, // Increased from 60 to 300 for debugging
});

// MongoDB injection protection
export const mongoSanitizer = mongoSanitize({
  replaceWith: "_",
  onSanitize: ({ req, key }) => {
    console.warn(`MongoDB injection attempt blocked: ${key} in ${req.method} ${req.path}`);
  },
});

// XSS protection for specific fields
export const sanitizeInput = (input: any): any => {
  if (typeof input === "string") {
    return xss(input, {
      whiteList: {},
      stripIgnoreTag: true,
      stripIgnoreTagBody: ["script"],
    });
  }
  if (Array.isArray(input)) {
    return input.map(sanitizeInput);
  }
  if (typeof input === "object" && input !== null) {
    const sanitized: any = {};
    for (const key in input) {
      if (input.hasOwnProperty(key)) {
        sanitized[key] = sanitizeInput(input[key]);
      }
    }
    return sanitized;
  }
  return input;
};

// Express middleware for input sanitization
export const sanitizeMiddleware = (req: Request, res: Response, next: NextFunction) => {
  req.body = sanitizeInput(req.body);
  req.query = sanitizeInput(req.query);
  req.params = sanitizeInput(req.params);
  next();
};

// Validation error handler
export const handleValidationErrors = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      message: "Validation failed",
      errors: errors.array() 
    });
  }
  next();
};

// SQL injection protection helper
export const escapeSQL = (str: string): string => {
  return str.replace(/[\0\x08\x09\x1a\n\r"'\\\%]/g, (char) => {
    switch (char) {
      case "\0":
        return "\\0";
      case "\x08":
        return "\\b";
      case "\x09":
        return "\\t";
      case "\x1a":
        return "\\z";
      case "\n":
        return "\\n";
      case "\r":
        return "\\r";
      case "\"":
      case "'":
      case "\\":
      case "%":
        return "\\" + char;
      default:
        return char;
    }
  });
};

// Request size limiting
export const requestSizeLimiter = {
  json: { limit: "10mb" },
  urlencoded: { limit: "10mb", extended: false },
};