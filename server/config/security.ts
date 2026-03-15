import { Request } from "express";

// Security configuration
export const securityConfig = {
  // Rate limiting disable flag - set to true to bypass all rate limiting
  disableRateLimiting: process.env.DISABLE_RATE_LIMITING === 'true',
  
  // Rate limiting configurations
  rateLimits: {
    general: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 1000,
    },
    auth: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 50,
      skipSuccessfulRequests: true,
    },
    api: {
      windowMs: 1 * 60 * 1000, // 1 minute
      max: 300,
    },
    passwordReset: {
      windowMs: 60 * 60 * 1000, // 1 hour
      max: 20,
    },
    registration: {
      windowMs: 60 * 60 * 1000, // 1 hour
      max: 50,
    },
  },

  // CORS configuration
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization"],
  },


  // Password policy
  passwordPolicy: {
    minLength: 10,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: true,
    preventCommonPasswords: true,
  },

  // Security headers
  headers: {
    // Prevent clickjacking
    frameOptions: "DENY",
    // Prevent MIME type sniffing
    contentTypeOptions: "nosniff",
    // Enable XSS protection
    xssProtection: true,
    // Force HTTPS
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
  },

  // File upload restrictions
  fileUpload: {
    maxSize: 10 * 1024 * 1024, // 10MB
    allowedMimeTypes: [
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
      "application/pdf",
      "text/csv",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ],
  },

  // IP whitelist/blacklist
  ipRestrictions: {
    enableWhitelist: false,
    whitelist: process.env.IP_WHITELIST?.split(",") || [],
    enableBlacklist: false,
    blacklist: process.env.IP_BLACKLIST?.split(",") || [],
  },

  // Content Security Policy
  csp: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://js.stripe.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://api.stripe.com", "https://tenginex.zendwise.work", "https://tenginex.zendwise.work/api/*", "https://tenginex.zendwise.work/health"],
      frameSrc: ["'self'", "https://js.stripe.com", "https://hooks.stripe.com"],
    },
  },
};

// Helper function to check if IP is allowed
export const isIpAllowed = (req: Request): boolean => {
  const clientIp = req.ip || req.connection.remoteAddress || "";
  
  // Check blacklist first
  if (securityConfig.ipRestrictions.enableBlacklist) {
    if (securityConfig.ipRestrictions.blacklist.includes(clientIp)) {
      return false;
    }
  }

  // Check whitelist
  if (securityConfig.ipRestrictions.enableWhitelist) {
    return securityConfig.ipRestrictions.whitelist.includes(clientIp);
  }

  return true;
};

// Common passwords to prevent
export const commonPasswords = [
  "password",
  "123456",
  "password123",
  "12345678",
  "qwerty",
  "abc123",
  "111111",
  "123456789",
  "letmein",
  "1234567",
  "football",
  "iloveyou",
  "admin",
  "welcome",
  "monkey",
  "login",
  "abc123",
  "starwars",
  "123123",
  "dragon",
  "passw0rd",
  "master",
  "hello",
  "freedom",
  "whatever",
  "qazwsx",
  "trustno1",
  "batman",
  "test",
  "password1",
];