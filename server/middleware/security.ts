import helmet from "helmet";
import rateLimit from "express-rate-limit";
import mongoSanitize from "express-mongo-sanitize";
import { getRedisSync } from "../utils/redisClient";
import xss from "xss";
import { validationResult, ValidationChain } from "express-validator";
import { Request, Response, NextFunction } from "express";

// Configure Helmet for security headers
export const helmetMiddleware = helmet({
  contentSecurityPolicy: process.env.NODE_ENV === 'development' ? {
    // More permissive CSP for development to allow external access
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://rsms.me"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://js.stripe.com", "https://accounts.google.com", "https://apis.google.com", "https://challenges.cloudflare.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "https://rsms.me"],
      imgSrc: ["'self'", "data:", "https:", "http:"],
      connectSrc: [
        "'self'",
        "https://api.stripe.com",
        "https://accounts.google.com",
        "https://oauth2.googleapis.com",
        "https://challenges.cloudflare.com",
        "https://tenginex.zendwise.work",
        "https://tenginex.zendwise.work/*",
        "https://*.zendwise.work",
        "https://*.zendwise.work/*",
        "https://weby.zendwise.work",
        "https://websy.zendwise.work",
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
      frameSrc: ["'self'", "https://js.stripe.com", "https://hooks.stripe.com", "https://accounts.google.com", "https://challenges.cloudflare.com"],
      // Explicitly disable upgrade-insecure-requests in development
      upgradeInsecureRequests: null,
    },
  } : {
    // Production CSP with stricter rules
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://rsms.me"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://js.stripe.com", "https://accounts.google.com", "https://apis.google.com", "https://challenges.cloudflare.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "https://rsms.me"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: [
        "'self'",
        "https://api.stripe.com",
        "https://accounts.google.com",
        "https://oauth2.googleapis.com",
        "https://challenges.cloudflare.com",
        "https://tenginex.zendwise.work",
        "https://tenginex.zendwise.work/*",
        "https://*.zendwise.work",
        "https://*.zendwise.work/*",
        "https://weby.zendwise.work",
        "https://websy.zendwise.work",
        "ws:",
        "wss:",
        "http://localhost:*",
        "https://localhost:*",
        "https://*.replit.dev",
        "https://*.repl.co"
      ],
      frameSrc: ["'self'", "https://js.stripe.com", "https://hooks.stripe.com", "https://accounts.google.com", "https://challenges.cloudflare.com"],
      upgradeInsecureRequests: [],
    },
  },
  crossOriginEmbedderPolicy: false,
  // Configure Cross-Origin-Opener-Policy for trusted domains
  crossOriginOpenerPolicy: process.env.NODE_ENV === 'development' ? false : { policy: "same-origin" },
  // Disable HSTS in development to prevent HTTPS enforcement
  hsts: process.env.NODE_ENV === 'production',
});

// Rate limiting configurations
//
// When REDIS_URL is configured we back express-rate-limit with
// `rate-limit-redis` so counters are shared across workers / pods and
// survive process restarts. Otherwise we fall back to the default
// in-memory store, which is partition-per-process and resets on restart
// (acceptable for local dev, NOT for production at scale).
//
// `rate-limit-redis` is loaded lazily via dynamic import, kicked off at
// module-load but NOT awaited at the top level (which would force the
// host module to be ES2022+). If the dep is missing we silently fall
// back to the in-memory store; createRateLimiter() only consults the
// factory after this has resolved (the early ms of process startup will
// briefly use memory store, which is acceptable).
let redisRateLimitStoreFactory: ((prefix: string) => any) | null = null;
void (async () => {
  try {
    // @ts-ignore optional peer dep
    const mod: any = await import('rate-limit-redis');
    const RedisStore = mod.default || mod.RedisStore || mod;
    redisRateLimitStoreFactory = (prefix: string) => {
      const client = getRedisSync();
      if (!client) return undefined;
      return new RedisStore({
        // ioredis exposes .call() which rate-limit-redis uses for SCRIPT etc.
        sendCommand: (...args: string[]) => client.call(...args),
        prefix: `rl:${prefix}:`,
      });
    };
  } catch {
    // rate-limit-redis not installed — silently fall back to memory store.
    redisRateLimitStoreFactory = null;
  }
})();

let rateLimiterCounter = 0;
export const createRateLimiter = (options: {
  windowMs?: number;
  max?: number;
  message?: string;
  skipSuccessfulRequests?: boolean;
  name?: string;
}) => {
  // Allow disabling rate limiting in development
  if (process.env.DISABLE_RATE_LIMITING === 'true') {
    return (req: any, res: any, next: any) => next();
  }

  const prefix = options.name || `g${++rateLimiterCounter}`;
  const store = redisRateLimitStoreFactory ? redisRateLimitStoreFactory(prefix) : undefined;

  return rateLimit({
    windowMs: options.windowMs || 15 * 60 * 1000, // 15 minutes default
    max: options.max || 100, // limit each IP to 100 requests per windowMs
    message: options.message || "Too many requests from this IP, please try again later.",
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: options.skipSuccessfulRequests || false,
    ...(store ? { store } : {}),
  });
};

// Default rate limiters
export const generalRateLimiter = createRateLimiter({
  name: 'general',
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000,
});

export const authRateLimiter = createRateLimiter({
  name: 'auth',
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50,
  message: "Too many authentication attempts, please try again later.",
  skipSuccessfulRequests: true,
});

export const apiRateLimiter = createRateLimiter({
  name: 'api',
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 300,
});

export const jwtTokenRateLimiter = createRateLimiter({
  name: 'jwt',
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: "Too many token generation requests. Please try again later.",
  skipSuccessfulRequests: false,
});

// Stricter rate limiter for credential-checking endpoints (login, 2FA check)
export const loginRateLimiter = createRateLimiter({
  name: 'login',
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: "Too many login attempts. Please try again later.",
  skipSuccessfulRequests: false,
});

// Rate limiter for 2FA verification attempts
export const twoFactorRateLimiter = createRateLimiter({
  name: '2fa',
  windowMs: 10 * 60 * 1000, // 10 minutes (matches temp session TTL)
  max: 5,
  message: "Too many 2FA verification attempts. Please try again later.",
  skipSuccessfulRequests: false,
});

// Rate limiter for activity log endpoints (read-heavy, prevent abuse)
export const activityLogRateLimiter = createRateLimiter({
  name: 'activity',
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 60,
  message: "Too many activity log requests. Please try again shortly.",
});

// Rate limiter for password reset REQUESTS (/forgot-password). Caps how
// often an IP can mint reset tokens / trigger reset emails.
export const forgotPasswordRateLimiter = createRateLimiter({
  name: 'pwreset-request',
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  message: "Too many password reset requests. Please try again later.",
  skipSuccessfulRequests: false,
});

// Rate limiter for actually CONSUMING a reset token (/reset-password).
// Decoupled from /forgot-password so an attacker spamming /forgot-password
// from the same NAT/IP cannot lock a legitimate user out of redeeming the
// reset link they just received. Successful resets don't count toward the
// limit (skipSuccessfulRequests) so the common-case flow is never blocked.
export const resetPasswordRateLimiter = createRateLimiter({
  name: 'pwreset-consume',
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  message: "Too many password reset attempts. Please try again later.",
  skipSuccessfulRequests: true,
});

// Back-compat alias — callers that still import `passwordResetRateLimiter`
// keep the old, request-side semantics. Prefer the explicit names above.
export const passwordResetRateLimiter = forgotPasswordRateLimiter;

// Rate limiter for /verify-email token consumption.
// JWT decode + DB lookups per hit — cap per-IP to block brute-force token guessing
// and "resend" spam from the verification page.
export const verifyEmailRateLimiter = createRateLimiter({
  name: 'verifyemail',
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  message: "Too many verification attempts. Please try again later.",
  skipSuccessfulRequests: true, // only count failed / invalid-token hits toward the limit
});

// Rate limiter for /resend-verification. Per-user 2-min cooldown is enforced
// in the handler via better_auth_user.last_verification_email_sent; this IP
// limiter stops spraying across many different email addresses from one source.
export const resendVerificationRateLimiter = createRateLimiter({
  name: 'resendverif',
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  message: "Too many verification email requests. Please try again later.",
  skipSuccessfulRequests: false,
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
  // Only sanitize if the body exists
  if (req.body !== undefined) {
    req.body = sanitizeInput(req.body);
  }
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