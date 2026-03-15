import { Request, Response, NextFunction } from "express";
import { securityConfig, isIpAllowed, commonPasswords } from "../config/security";

// IP restriction middleware
export const ipRestrictionMiddleware = (req: Request, res: Response, next: NextFunction) => {
  if (!isIpAllowed(req)) {
    return res.status(403).json({ message: "Access denied from this IP address" });
  }
  next();
};

// Enhanced password validation
export const validatePasswordStrength = (password: string): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];
  const policy = securityConfig.passwordPolicy;

  if (password.length < policy.minLength) {
    errors.push(`Password must be at least ${policy.minLength} characters long`);
  }

  if (policy.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push("Password must contain at least one uppercase letter");
  }

  if (policy.requireLowercase && !/[a-z]/.test(password)) {
    errors.push("Password must contain at least one lowercase letter");
  }

  if (policy.requireNumbers && !/[0-9]/.test(password)) {
    errors.push("Password must contain at least one number");
  }

  if (policy.requireSpecialChars && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push("Password must contain at least one special character");
  }

  if (policy.preventCommonPasswords) {
    const lowerPassword = password.toLowerCase();
    if (commonPasswords.includes(lowerPassword)) {
      errors.push("Password is too common. Please choose a stronger password");
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

// Request logging middleware for security auditing
export const securityAuditLogger = (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();
  
  // Log security-relevant events
  res.on("finish", () => {
    const duration = Date.now() - startTime;
    const logData = {
      timestamp: new Date().toISOString(),
      method: req.method,
      path: req.path,
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get("User-Agent"),
      statusCode: res.statusCode,
      duration,
    };

    // Log authentication failures
    if (req.path.includes("/auth") && res.statusCode === 401) {
      console.log("[SECURITY AUDIT] Authentication failure:", logData);
    }

    // Log rate limit hits
    if (res.statusCode === 429) {
      console.log("[SECURITY AUDIT] Rate limit exceeded:", logData);
    }

    // Log suspicious activity
    if (res.statusCode === 403 || res.statusCode >= 400) {
      console.log("[SECURITY AUDIT] Potential security event:", logData);
    }
  });

  next();
};

// Prevent timing attacks on string comparison
export const safeCompare = (a: string, b: string): boolean => {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    // Compare against self to consume constant time, then return false
    require('crypto').timingSafeEqual(bufA, bufA);
    return false;
  }
  return require('crypto').timingSafeEqual(bufA, bufB);
};

// Generate secure random tokens (uses crypto.randomBytes to avoid modulo bias)
export const generateSecureToken = (length: number = 32): string => {
  return require('crypto').randomBytes(length).toString('base64url').slice(0, length);
};

// CSRF protection middleware (for non-API routes)
export const csrfProtection = (req: Request, res: Response, next: NextFunction) => {
  // Skip CSRF for API routes that use JWT
  if (req.path.startsWith("/api")) {
    return next();
  }

  const token = req.headers["x-csrf-token"] || req.body._csrf;
  const sessionToken = (req as any).session?.csrfToken;

  if (!token || !sessionToken || !safeCompare(token, sessionToken)) {
    return res.status(403).json({ message: "Invalid CSRF token" });
  }

  next();
};

// Security headers middleware (additional to Helmet)
export const additionalSecurityHeaders = (req: Request, res: Response, next: NextFunction) => {
  // Prevent information leakage
  res.removeHeader("X-Powered-By");
  
  // Additional security headers
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "geolocation=(), microphone=(), camera=()");
  
  next();
};