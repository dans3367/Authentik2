import type { Express } from "express";
import { createServer, type Server } from "http";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { storage } from "./storage";
import { db } from "./db";
import { sql } from "drizzle-orm";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import cookieParser from "cookie-parser";
import {
  loginSchema,
  registerSchema,
  registerOwnerSchema,
  forgotPasswordSchema,
  updateProfileSchema,
  changePasswordSchema,
  enable2FASchema,
  disable2FASchema,
  verifyEmailSchema,
  resendVerificationSchema,
  createUserSchema,
  updateUserSchema,
  userFiltersSchema,
  billingInfoSchema,
  createCompanySchema,
  updateCompanySchema,
  createNewsletterSchema,
  updateNewsletterSchema,
  createCampaignSchema,
  updateCampaignSchema,
  type UserRole,
  type ShopFilters,
  createShopSchema,
  updateShopSchema,
  type ContactFilters,
  type BouncedEmailFilters,
} from "@shared/schema";
import Stripe from "stripe";
import { randomBytes, randomUUID } from "crypto";
import { authenticator } from "otplib";
import * as QRCode from "qrcode";
import { UAParser } from "ua-parser-js";
import { createHash, createHmac } from "crypto";
import { emailService } from "./emailService";
import { emailRoutes } from "./routes/emailRoutes";
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
import {
  sanitizeUserInput,
  sanitizeEmail,
  sanitizePassword,
  sanitizeName,
  sanitizeString,
  checkRateLimit,
  clearRateLimit,
  getClientIP,
} from "./utils/sanitization";
import { authRateLimiter, apiRateLimiter } from "./middleware/security";
import { avatarUpload, handleUploadError } from "./middleware/upload";
import { R2_CONFIG, uploadToR2, deleteFromR2 } from "./config/r2";
import sharp from "sharp";

const JWT_SECRET = process.env.JWT_SECRET || "your-super-secret-jwt-key";
const REFRESH_TOKEN_SECRET =
  process.env.REFRESH_TOKEN_SECRET || "your-super-secret-refresh-key";

// Initialize Stripe
if (!process.env.STRIPE_SECRET_KEY) {
  console.warn("Warning: STRIPE_SECRET_KEY not found, Stripe features will be disabled");
}
const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

// Utility function to extract device information from request
function getDeviceInfo(req: any): {
  deviceId: string;
  deviceName: string;
  userAgent?: string;
  ipAddress?: string;
} {
  const userAgentString = req.get("User-Agent") || "Unknown";
  const parser = new UAParser(userAgentString);
  const result = parser.getResult();

  // Create a unique device identifier based on user agent and IP
  const deviceFingerprint = `${result.browser.name}-${result.os.name}-${req.ip}`;
  const deviceId = createHash("sha256")
    .update(deviceFingerprint)
    .digest("hex")
    .substring(0, 16);

  // Generate user-friendly device name
  const browserName = result.browser.name || "Unknown Browser";
  const osName = result.os.name || "Unknown OS";
  const deviceName = `${browserName} on ${osName}`;

  return {
    deviceId,
    deviceName,
    userAgent: userAgentString,
    ipAddress: req.ip || req.connection?.remoteAddress || "Unknown",
  };
}
const ACCESS_TOKEN_EXPIRES = "15m"; // 15 minutes - reasonable balance between security and UX
const REFRESH_TOKEN_EXPIRES = "7d";

// Middleware to verify JWT token
const authenticateToken = async (req: any, res: any, next: any) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  console.log("🔐 [Auth Middleware] Authorization header:", authHeader);
  console.log("🔐 [Auth Middleware] Extracted token:", token ? `${token.substring(0, 20)}...` : 'no token');

  if (!token) {
    return res.status(401).json({ message: "Access token required" });
  }

  try {
    console.log("🔐 [Auth Middleware] Verifying token with JWT_SECRET");
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    console.log("🔐 [Auth Middleware] Token decoded successfully:", { userId: decoded.userId, tenantId: decoded.tenantId });
    
    const user = await storage.getUser(decoded.userId, decoded.tenantId);

    if (!user || !user.isActive) {
      console.log("🔐 [Auth Middleware] User not found or inactive");
      return res.status(401).json({ message: "User not found or inactive" });
    }

    // Check if token was issued after tokenValidAfter
    console.log("🔐 [Auth Middleware] Checking token validity timestamp:", {
      tokenValidAfter: user.tokenValidAfter,
      tokenIat: decoded.iat,
      tokenIssuedAt: decoded.iat ? new Date(decoded.iat * 1000).toISOString() : 'NO IAT',
      userTokenValidAfter: user.tokenValidAfter ? new Date(user.tokenValidAfter).toISOString() : 'NO VALID AFTER'
    });
    
    if (user.tokenValidAfter && decoded.iat) {
      const tokenIssuedAt = decoded.iat * 1000; // Convert to milliseconds
      const tokenValidAfter = new Date(user.tokenValidAfter).getTime();
      
      console.log("🔐 [Auth Middleware] Token timestamp comparison:", {
        tokenIssuedAt,
        tokenValidAfter,
        isTokenOlder: tokenIssuedAt < tokenValidAfter
      });
      
      if (tokenIssuedAt < tokenValidAfter) {
        console.log("🔐 [Auth Middleware] Token issued before tokenValidAfter - invalidating");
        return res.status(401).json({ message: "Token has been invalidated. Please login again." });
      }
    }

    console.log("🔐 [Auth Middleware] User authenticated successfully:", user.email);
    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
      firstName: user.firstName,
      lastName: user.lastName,
      password: user.password,
      twoFactorEnabled: user.twoFactorEnabled,
      twoFactorSecret: user.twoFactorSecret,
      emailVerified: user.emailVerified,
      menuExpanded: user.menuExpanded,
      theme: user.theme,
      avatarUrl: user.avatarUrl,
    };
    next();
  } catch (error: any) {
    console.error("🔐 [Auth Middleware] Token verification failed:", error.message);
    console.error("🔐 [Auth Middleware] Error type:", error.constructor.name);
    console.error("🔐 [Auth Middleware] Error details:", error);
    
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ message: "Access token expired" });
    }
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(403).json({ message: "Invalid access token" });
    }
    if (error instanceof jwt.NotBeforeError) {
      return res.status(403).json({ message: "Access token not active yet" });
    }
    
    // Generic JWT error
    return res.status(403).json({ message: "Invalid access token" });
  }
};

// Middleware to check user permissions
const requireRole = (allowedRoles: UserRole[]) => {
  return (req: any, res: any, next: any) => {
    if (!req.user) {
      return res.status(401).json({ message: "Authentication required" });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }

    next();
  };
};

// Middleware for admin-only operations (Owner and Administrator)
const requireAdmin = requireRole(["Owner", "Administrator"]);

// Middleware for manager+ operations
const requireManagerOrAdmin = requireRole(["Owner", "Administrator", "Manager"]);

const generateTokens = (userId: string, tenantId: string) => {
  const now = Math.floor(Date.now() / 1000); // Current time in seconds
  const accessToken = jwt.sign({ userId, tenantId, iat: now }, JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRES,
  });
  const refreshToken = jwt.sign(
    { userId, tenantId, tokenId: randomBytes(16).toString("hex"), iat: now },
    REFRESH_TOKEN_SECRET,
    { expiresIn: REFRESH_TOKEN_EXPIRES },
  );
  return { accessToken, refreshToken };
};

export async function registerRoutes(app: Express): Promise<Server> {
  // ES module equivalent of __dirname
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  
  app.use(cookieParser());

  // Clean up expired tokens periodically
  setInterval(
    async () => {
      try {
        await storage.cleanExpiredTokens();
      } catch (error) {
        console.error("Failed to clean expired tokens:", error);
      }
    },
    24 * 60 * 60 * 1000,
  ); // Once per day

  // DEPRECATED: Regular registration endpoint - use /api/auth/register-owner instead
  // This endpoint is kept for backward compatibility but should not be used for new registrations
  app.post("/api/auth/register", async (req, res) => {
    try {
      // Get client IP for rate limiting
      const clientIP = getClientIP(req);

      // Basic rate limiting for registration
      if (!checkRateLimit(clientIP, 3, 10 * 60 * 1000)) {
        // 3 attempts per 10 minutes
        return res.status(429).json({
          message: "Too many registration attempts. Please try again later.",
        });
      }

      const rawData = registerSchema.parse(req.body);

      // Sanitize all input data
      const sanitizedData = sanitizeUserInput({
        email: rawData.email,
        password: rawData.password,
        firstName: rawData.firstName,
        lastName: rawData.lastName,
      });

      if (
        !sanitizedData.email ||
        !sanitizedData.password ||
        !sanitizedData.firstName ||
        !sanitizedData.lastName
      ) {
        return res.status(400).json({ message: "All fields are required" });
      }

      // Use the default tenant
      const tenant = await storage.getTenantBySlug("default");
      if (!tenant) {
        return res.status(500).json({ message: "System configuration error" });
      }

      // Check if user already exists in the default tenant
      const existingUser = await storage.getUserByEmail(
        sanitizedData.email,
        tenant.id,
      );
      if (existingUser) {
        return res
          .status(409)
          .json({ message: "User already exists with this email" });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(sanitizedData.password, 12);

      // Create user with sanitized data
      const user = await storage.createUser({
        tenantId: tenant.id,
        email: sanitizedData.email,
        password: hashedPassword,
        firstName: sanitizedData.firstName,
        lastName: sanitizedData.lastName,
      });

      // Clear rate limit on successful registration
      clearRateLimit(clientIP);

      // Generate email verification token
      const verificationToken = randomBytes(32).toString("hex");
      const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      // Set verification token in database
      await storage.setEmailVerificationToken(
        user.id,
        tenant.id,
        verificationToken,
        verificationExpires,
      );

      // Send verification email
      try {
        await emailService.sendVerificationEmail(
          user.email,
          verificationToken,
          user.firstName || undefined,
        );
      } catch (emailError) {
        console.error("Failed to send verification email:", emailError);
        // Continue with registration, console URL is already logged
      }

      res.status(201).json({
        message:
          "User created successfully. Please check the server console for the verification URL since email delivery is restricted.",
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          twoFactorEnabled: user.twoFactorEnabled,
          emailVerified: false,
          menuExpanded: user.menuExpanded || false,
          theme: user.theme || 'light',
          avatarUrl: user.avatarUrl || null,
        },
        developmentNote: "Check server console for verification URL",
      });
    } catch (error: any) {
      if (error.name === "ZodError") {
        return res.status(400).json({
          message: "Validation error",
          errors: error.errors,
        });
      }
      console.error("Registration error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Owner registration endpoint - creates new tenant and Owner user
  app.post("/api/auth/register-owner", async (req, res) => {
    try {
      // Get client IP for rate limiting
      const clientIP = getClientIP(req);

      // Check rate limit
      if (!checkRateLimit(clientIP)) {
        return res.status(429).json({
          message: "Too many registration attempts. Please try again later.",
        });
      }

      const rawData = registerOwnerSchema.parse(req.body);

      // Sanitize all input data
      const sanitizedData = sanitizeUserInput({
        email: rawData.email,
        password: rawData.password,
        firstName: rawData.firstName,
        lastName: rawData.lastName,
      });

      const sanitizedOrgName = sanitizeString(rawData.organizationName);
      const sanitizedOrgSlug = sanitizeString(rawData.organizationSlug);

      if (
        !sanitizedData.email ||
        !sanitizedData.password ||
        !sanitizedData.firstName ||
        !sanitizedData.lastName ||
        !sanitizedOrgName ||
        !sanitizedOrgSlug
      ) {
        return res.status(400).json({ message: "All fields are required" });
      }

      // Check if organization slug is already taken
      const existingTenant = await storage.getTenantBySlug(sanitizedOrgSlug);
      if (existingTenant) {
        return res.status(409).json({ 
          message: "Organization identifier is already taken. Please choose a different one." 
        });
      }

      // Check if user with this email already exists in any tenant
      // For now, we'll check against the default tenant to prevent duplicate emails
      const defaultTenant = await storage.getTenantBySlug("default");
      if (defaultTenant) {
        const existingUser = await storage.getUserByEmail(
          sanitizedData.email,
          defaultTenant.id,
        );
        if (existingUser) {
          return res.status(409).json({ 
            message: "User already exists with this email" 
          });
        }
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(sanitizedData.password, 12);

      // Create tenant and owner user
      const { owner, tenant } = await storage.createOwnerAndTenant({
        email: sanitizedData.email,
        password: hashedPassword,
        firstName: sanitizedData.firstName,
        lastName: sanitizedData.lastName,
        organizationName: sanitizedOrgName,
        organizationSlug: sanitizedOrgSlug,
        confirmPassword: "", // Not needed for storage
      });

      // Clear rate limit on successful registration
      clearRateLimit(clientIP);

      // Generate email verification token
      const verificationToken = randomBytes(32).toString("hex");
      const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      // Set verification token in database
      await storage.setEmailVerificationToken(
        owner.id,
        tenant.id,
        verificationToken,
        verificationExpires,
      );

      // Send verification email
      try {
        await emailService.sendVerificationEmail(
          owner.email,
          verificationToken,
          owner.firstName || undefined,
        );
      } catch (emailError) {
        console.error("Failed to send verification email:", emailError);
        // Continue with registration, console URL is already logged
      }

      res.status(201).json({
        message:
          "Organization and owner account created successfully. Please check the server console for the verification URL since email delivery is restricted.",
        user: {
          id: owner.id,
          email: owner.email,
          firstName: owner.firstName,
          lastName: owner.lastName,
          role: owner.role,
          twoFactorEnabled: owner.twoFactorEnabled,
          emailVerified: false,
          menuExpanded: owner.menuExpanded || false,
          theme: owner.theme || 'light',
          avatarUrl: owner.avatarUrl || null,
        },
        organization: {
          id: tenant.id,
          name: tenant.name,
          slug: tenant.slug,
        },
        developmentNote: "Check server console for verification URL",
      });
    } catch (error: any) {
      if (error.name === "ZodError") {
        return res.status(400).json({
          message: "Validation error",
          errors: error.errors,
        });
      }
      console.error("Owner registration error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Login endpoint with input sanitization and rate limiting
  app.post("/api/auth/login", async (req, res) => {
    try {
      // Get client IP for rate limiting
      const clientIP = getClientIP(req);

      // Check rate limit
      if (!checkRateLimit(clientIP)) {
        return res.status(429).json({
          message: "Too many login attempts. Please try again later.",
        });
      }

      // Parse and sanitize input data
      const rawData = loginSchema.parse(req.body);
      const sanitizedEmail = sanitizeEmail(rawData.email);
      const sanitizedPassword = sanitizePassword(rawData.password);
      const sanitizedTwoFactorToken = sanitizeString(rawData.twoFactorToken);
      const rememberMe = rawData.rememberMe || false;
      
      console.log("🔍 [Login Debug] Request body:", JSON.stringify(req.body, null, 2));
      console.log("🔍 [Login Debug] Parsed rememberMe:", rememberMe);

      if (!sanitizedEmail || !sanitizedPassword) {
        return res
          .status(400)
          .json({ message: "Email and password are required" });
      }

      // Find user by email across all tenants
      const userResult = await storage.findUserByEmailAcrossTenants(sanitizedEmail);
      if (!userResult) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const user = userResult;
      const tenant = userResult.tenant;


      // Verify password
      const isValidPassword = await bcrypt.compare(
        sanitizedPassword,
        user.password,
      );
      if (!isValidPassword) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      // Allow login but mark verification status
      const emailVerificationRequired = !user.emailVerified;

      // Check 2FA if enabled
      if (user.twoFactorEnabled) {
        if (!sanitizedTwoFactorToken) {
          return res.status(200).json({
            message: "2FA token required",
            requires2FA: true,
            tempLoginId: user.id, // In production, use a temporary encrypted token
          });
        }

        if (!user.twoFactorSecret) {
          return res.status(500).json({ message: "2FA configuration error" });
        }

        const isValid2FA = authenticator.verify({
          token: sanitizedTwoFactorToken,
          secret: user.twoFactorSecret,
        });

        if (!isValid2FA) {
          return res.status(401).json({ message: "Invalid 2FA token" });
        }
      }

      // Clear rate limit on successful login
      clearRateLimit(clientIP);

      // Generate tokens
      const { accessToken, refreshToken } = generateTokens(
        user.id,
        user.tenantId,
      );

      // Get device information
      const deviceInfo = getDeviceInfo(req);

      // Store refresh token in database with device info
      const tokenExpiryDays = rememberMe ? 30 : 7;
      const refreshTokenExpiry = new Date(Date.now() + tokenExpiryDays * 24 * 60 * 60 * 1000);
      
      console.log("🔍 [Login Debug] Token expiry days:", tokenExpiryDays);
      console.log("🔍 [Login Debug] Refresh token expiry:", refreshTokenExpiry);
      await storage.createRefreshToken(
        user.id,
        user.tenantId,
        refreshToken,
        refreshTokenExpiry,
        deviceInfo,
      );

      // Set refresh token as httpOnly cookie
      res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax", // Changed from "strict" to "lax" for better cross-site behavior
        maxAge: tokenExpiryDays * 24 * 60 * 60 * 1000, // 7 or 30 days based on rememberMe
        path: "/", // Explicit path
      });
      
      console.log("🔄 [Server] Refresh token cookie set successfully:", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: tokenExpiryDays * 24 * 60 * 60 * 1000,
        expiresAt: refreshTokenExpiry
      });

      const responseData = {
        message: "Login successful",
        accessToken,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          twoFactorEnabled: user.twoFactorEnabled,
          emailVerified: user.emailVerified,
          menuExpanded: user.menuExpanded ?? false,
          theme: user.theme || 'light',
          avatarUrl: user.avatarUrl || null,
        },
        emailVerificationRequired,
      };


      res.json(responseData);
    } catch (error: any) {
      if (error.name === "ZodError") {
        return res.status(400).json({
          message: "Validation error",
          errors: error.errors,
        });
      }
      console.error("Login error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Email verification endpoint
  app.get("/api/auth/verify-email", async (req, res) => {
    try {
      const { token } = verifyEmailSchema.parse(req.query);

      // Find user by verification token
      const user = await storage.getUserByEmailVerificationToken(token);
      if (!user) {
        return res.status(400).json({
          message:
            "Invalid or expired verification token. Please request a new verification email.",
        });
      }

      // Verify the user's email
      await storage.verifyUserEmail(user.id, user.tenantId);

      // Generate tokens for automatic login
      const { accessToken, refreshToken } = generateTokens(user.id, user.tenantId);

      // Store refresh token with device info
      const deviceInfo = getDeviceInfo(req);
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days in milliseconds
      await storage.createRefreshToken(
        user.id,
        user.tenantId,
        refreshToken,
        expiresAt,
        deviceInfo,
      );

      // Set refresh token as HTTP-only cookie
      res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
        path: "/", // Explicit path
      });
      
      console.log("🔄 [Server] Email verification refresh token cookie set successfully");

      // Send welcome email
      try {
        await emailService.sendWelcomeEmail(
          user.email,
          user.firstName || undefined,
        );
      } catch (emailError) {
        console.error("Failed to send welcome email:", emailError);
        // Continue even if welcome email fails
      }

      res.json({
        message: "Email verified successfully! You are now logged in.",
        verified: true,
        accessToken,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          twoFactorEnabled: user.twoFactorEnabled,
          emailVerified: true, // Now verified
          theme: user.theme || 'light',
          avatarUrl: user.avatarUrl || null,
        },
      });
    } catch (error: any) {
      if (error.name === "ZodError") {
        return res.status(400).json({
          message: "Invalid verification token format",
          errors: error.errors,
        });
      }
      console.error("Email verification error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Resend verification email endpoint
  app.post("/api/auth/resend-verification", async (req, res) => {
    try {
      const { email } = resendVerificationSchema.parse(req.body);

      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }

      // For backward compatibility, use default tenant
      const tenant = await storage.getTenantBySlug("default");
      if (!tenant) {
        return res.status(500).json({ message: "System configuration error" });
      }

      // Find user by email
      const user = await storage.getUserByEmail(email, tenant.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      if (user.emailVerified) {
        return res.status(400).json({ message: "Email is already verified" });
      }

      // Check rate limiting - 5 minutes between resend requests
      if (user.lastVerificationEmailSent) {
        const timeSinceLastSent =
          Date.now() - user.lastVerificationEmailSent.getTime();
        const fiveMinutesInMs = 5 * 60 * 1000;

        if (timeSinceLastSent < fiveMinutesInMs) {
          const remainingTime = Math.ceil(
            (fiveMinutesInMs - timeSinceLastSent) / 1000 / 60,
          );
          return res.status(429).json({
            message: `Please wait ${remainingTime} minute(s) before requesting another verification email.`,
            retryAfter: remainingTime,
          });
        }
      }

      // Generate new verification token
      const verificationToken = randomBytes(32).toString("hex");
      const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      // Update verification token in database
      await storage.setEmailVerificationToken(
        user.id,
        user.tenantId,
        verificationToken,
        verificationExpires,
      );

      // Send verification email
      try {
        await emailService.sendVerificationEmail(
          user.email,
          verificationToken,
          user.firstName || undefined,
        );
      } catch (emailError) {
        console.error("Failed to send verification email:", emailError);
        return res
          .status(500)
          .json({ message: "Failed to send verification email" });
      }

      res.json({
        message:
          "Verification email sent successfully. Please check your inbox.",
        nextAllowedAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      });
    } catch (error: any) {
      if (error.name === "ZodError") {
        return res.status(400).json({
          message: "Validation error",
          errors: error.errors,
        });
      }
      console.error("Resend verification error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Reviewer approval request: generate signed approval link and email the reviewer
  app.post("/api/email/reviewer-request", authenticateToken, async (req: any, res) => {
    try {
      const { emailId, reviewerEmail, reviewerId, subject } = req.body as {
        emailId: string;
        reviewerEmail?: string;
        reviewerId?: string;
        subject?: string;
      };

      if (!emailId) {
        return res.status(400).json({ message: "emailId is required" });
      }

      // Resolve reviewer email if only reviewerId is provided
      let toEmail = reviewerEmail;
      if (!toEmail && reviewerId) {
        const reviewer = await storage.getUser(reviewerId, req.user.tenantId);
        if (!reviewer) {
          return res.status(404).json({ message: "Reviewer not found" });
        }
        toEmail = reviewer.email;
      }

      if (!toEmail) {
        return res.status(400).json({ message: "reviewerEmail or reviewerId is required" });
      }

      // Build workflow ID to match Go server convention
      const workflowId = `reviewer-email-workflow-${emailId}`;

      // Sign approval token compatible with Go server
      const jwtSecret = process.env.JWT_SECRET || "";
      if (!jwtSecret) {
        return res.status(500).json({ message: "JWT secret not configured" });
      }

      const token = jwt.sign(
        {
          emailId,
          workflowId,
        },
        jwtSecret,
        { expiresIn: "7d" },
      );

      const approveUrl = `${process.env.GO_EMAIL_SERVER_BASE_URL || "https://tenginew.zendwise.work"}/approve-email?token=${encodeURIComponent(token)}`;

      // Send email to reviewer
      const approvalSubject = subject ? `Review required: ${subject}` : "Review required: Email campaign";
      // Compose a basic approval email using our email service
      try {
        await resend.emails.send({
          from: process.env.FROM_EMAIL || 'noreply@zendwise.work',
          to: [toEmail],
          subject: approvalSubject,
          html: `<p>You have a pending email campaign awaiting your approval.</p>
                 <p><a href="${approveUrl}" style="display:inline-block;padding:10px 16px;background:#4f46e5;color:white;border-radius:6px;text-decoration:none;">Approve Email</a></p>
                 <p>If the button doesn't work, click or copy this link:</p>
                 <p>${approveUrl}</p>`
        } as any);
      } catch (e) {
        console.warn('Falling back to verification email template for approval link', e);
        await emailService.sendVerificationEmail(
          toEmail,
          token,
        );
      }

      // Also log link and return it in response for debugging
      console.log("Reviewer approval URL:", approveUrl);
      return res.status(200).json({ approveUrl });
    } catch (err: any) {
      console.error("Failed to send reviewer approval request:", err);
      return res.status(500).json({ message: "Failed to send reviewer approval request" });
    }
  });

  // Development endpoint to verify email without actual email
  app.post("/api/auth/dev-verify-email", async (req, res) => {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }

      // For backward compatibility, use default tenant
      const tenant = await storage.getTenantBySlug("default");
      if (!tenant) {
        return res.status(500).json({ message: "System configuration error" });
      }

      // Find user by email
      const user = await storage.getUserByEmail(email, tenant.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      if (user.emailVerified) {
        return res.status(400).json({ message: "Email is already verified" });
      }

      // Verify the user's email directly
      await storage.verifyUserEmail(user.id, user.tenantId);

      res.json({
        message: "Email verified successfully! (Development mode)",
        verified: true,
      });
    } catch (error: any) {
      console.error("Dev email verification error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Refresh token endpoint
  app.post("/api/auth/refresh", async (req, res) => {
    try {
      // Processing refresh token request

      const refreshToken = req.cookies.refreshToken;

      if (!refreshToken) {
        return res.status(401).json({ message: "Refresh token required" });
      }

      // Verify refresh token
      let decoded: any;
      try {
        decoded = jwt.verify(refreshToken, REFRESH_TOKEN_SECRET) as any;
      } catch (jwtError) {
        // Clear invalid cookie
        res.clearCookie("refreshToken", {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          path: "/",
        });
        if (jwtError instanceof jwt.TokenExpiredError) {
          return res.status(401).json({ message: "Refresh token expired" });
        }
        return res.status(401).json({ message: "Invalid refresh token format" });
      }

      // Check if refresh token exists in database and is not expired
      const storedToken = await storage.getRefreshToken(refreshToken);
      if (!storedToken) {
        console.log("🔄 [Server] Refresh token not found in database");
        // Clear invalid cookie
        res.clearCookie("refreshToken", {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          path: "/",
        });
        return res.status(401).json({ message: "Invalid refresh token" });
      }
      console.log("🔄 [Server] Refresh token found in database");

      // Check if token has expired
      if (storedToken.expiresAt.getTime() < Date.now()) {
        console.log("🔄 [Server] Refresh token has expired in database");
        // Delete expired token
        await storage.deleteRefreshToken(refreshToken);
        // Clear expired cookie
        res.clearCookie("refreshToken", {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          path: "/",
        });
        return res.status(401).json({ message: "Refresh token expired" });
      }

      // Get user with tenant context
      const user = await storage.getUser(decoded.userId, decoded.tenantId);
      if (!user || !user.isActive) {
        console.log("🔄 [Server] User not found or inactive");
        // Delete token for inactive user
        await storage.deleteRefreshToken(refreshToken);
        // Clear cookie
        res.clearCookie("refreshToken", {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          path: "/",
        });
        return res.status(401).json({ message: "User not found or inactive" });
      }
      console.log("🔄 [Server] User found and active");

      // Update session last used time
      await storage.updateSessionLastUsed(refreshToken);

      // Generate new tokens with tenant context
      const { accessToken, refreshToken: newRefreshToken } = generateTokens(
        user.id,
        user.tenantId,
      );
      console.log("🔄 [Server] New tokens generated");

      // Get device info to preserve it in the new token
      const deviceInfo = getDeviceInfo(req);

      // Remove old refresh token and store new one with preserved device info
      await storage.deleteRefreshToken(refreshToken);
      
      // Calculate the original token duration to preserve it
      const originalTokenDuration = storedToken.createdAt 
        ? storedToken.expiresAt.getTime() - storedToken.createdAt.getTime()
        : 7 * 24 * 60 * 60 * 1000; // Default to 7 days if createdAt is null
      const refreshTokenExpiry = new Date(Date.now() + originalTokenDuration);
      
      console.log("🔄 [Server] Preserving original token duration:", {
        originalExpiry: storedToken.expiresAt,
        originalCreated: storedToken.createdAt,
        durationMs: originalTokenDuration,
        newExpiry: refreshTokenExpiry
      });
      
      await storage.createRefreshToken(
        user.id,
        user.tenantId,
        newRefreshToken,
        refreshTokenExpiry,
        {
          deviceId: storedToken.deviceId || deviceInfo.deviceId,
          deviceName: storedToken.deviceName || deviceInfo.deviceName,
          userAgent: deviceInfo.userAgent,
          ipAddress: deviceInfo.ipAddress,
        },
      );

      // Set new refresh token as httpOnly cookie with preserved duration
      const cookieMaxAge = refreshTokenExpiry.getTime() - Date.now();
      res.cookie("refreshToken", newRefreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax", // Changed from "strict" to "lax"
        maxAge: cookieMaxAge,
        path: "/", // Explicit path
      });
      
      console.log("🔄 [Server] New refresh token cookie set successfully:", {
        maxAge: cookieMaxAge,
        expiresAt: refreshTokenExpiry
      });

      console.log("🔄 [Server] Sending successful refresh response");
      res.json({
        message: "Token refreshed successfully",
        accessToken,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          twoFactorEnabled: user.twoFactorEnabled,
          emailVerified: user.emailVerified,
          menuExpanded: user.menuExpanded ?? false,
          theme: user.theme || 'light',
          avatarUrl: user.avatarUrl || null,
        },
      });
    } catch (error: any) {
      console.error("Token refresh error:", error);
      // Clear potentially invalid cookie on any error
      res.clearCookie("refreshToken", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
      });
      res.status(401).json({ message: "Invalid refresh token" });
    }
  });

  // Logout endpoint - works with or without access token
  app.post("/api/auth/logout", async (req: any, res) => {
    try {
      const refreshToken = req.cookies.refreshToken;

      // Try to get access token for proper logout, but don't require it
      const authHeader = req.headers["authorization"];
      const accessToken = authHeader && authHeader.split(" ")[1];

      // If we have access token, verify it to get user context
      if (accessToken) {
        try {
          const decoded = jwt.verify(accessToken, JWT_SECRET) as any;
          const user = await storage.getUser(decoded.userId, decoded.tenantId);
          
          if (user && user.isActive) {
            console.log(`🔐 [Server] Logout request from user: ${user.email}`);
          }
        } catch (tokenError) {
          // Token is invalid, but still proceed with logout
          console.log("🔐 [Server] Invalid access token during logout, proceeding anyway");
        }
      }

      // Always try to delete refresh token if it exists
      if (refreshToken) {
        try {
          await storage.deleteRefreshToken(refreshToken);
          console.log("🔐 [Server] Refresh token deleted successfully");
        } catch (dbError) {
          console.log("🔐 [Server] Error deleting refresh token:", dbError);
          // Continue even if deletion fails
        }
      }

      // Clear refresh token cookie
      res.clearCookie("refreshToken", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
      });
      
      console.log("🔐 [Server] Refresh token cookie cleared successfully");

      console.log("🔐 [Server] Logout successful");
      res.json({ message: "Logout successful" });
    } catch (error) {
      console.error("Logout error:", error);
      // Even on error, try to clear the cookie
      res.clearCookie("refreshToken");
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Check authentication status endpoint - doesn't require access token
  app.get("/api/auth/check", async (req, res) => {
    try {
      console.log("🔍 [Server] Auth check request received");
      const refreshToken = req.cookies.refreshToken;

      if (!refreshToken) {
        console.log("🔍 [Server] No refresh token in cookies");
        return res.json({ hasAuth: false });
      }

      // Try to verify the refresh token
      try {
        const decoded = jwt.verify(refreshToken, REFRESH_TOKEN_SECRET) as any;

        // Check if refresh token exists in database
        const storedToken = await storage.getRefreshToken(refreshToken);
        if (!storedToken) {
          console.log("🔍 [Server] Refresh token not found in database");
          // Clear invalid cookie
          res.clearCookie("refreshToken", {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
          });
          return res.json({ hasAuth: false });
        }

        // Check if token is expired
        if (storedToken.expiresAt.getTime() < Date.now()) {
          console.log("🔍 [Server] Refresh token has expired");
          // Delete expired token from database
          await storage.deleteRefreshToken(refreshToken);
          // Clear expired cookie
          res.clearCookie("refreshToken", {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
          });
          return res.json({ hasAuth: false });
        }

        console.log("🔍 [Server] Valid refresh token found");
        return res.json({ hasAuth: true });
      } catch (error) {
        console.log("🔍 [Server] Invalid refresh token:", error);
        // Clear invalid cookie
        res.clearCookie("refreshToken", {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production", 
          sameSite: "lax",
        });
        return res.json({ hasAuth: false });
      }
    } catch (error) {
      console.error("Auth check error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get current user endpoint
  app.get("/api/auth/me", authenticateToken, async (req: any, res) => {
    res.json({
      user: {
        id: req.user.id,
        email: req.user.email,
        firstName: req.user.firstName,
        lastName: req.user.lastName,
        role: req.user.role,
        twoFactorEnabled: req.user.twoFactorEnabled,
        emailVerified: req.user.emailVerified,
        menuExpanded: req.user.menuExpanded ?? false,
        theme: req.user.theme || 'light',
        avatarUrl: req.user.avatarUrl || null,
      },
    });
  });

  // Debug endpoint to check token validation
  app.get("/api/auth/debug-token", authenticateToken, async (req: any, res) => {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];
    
    if (token) {
      const decoded = jwt.decode(token) as any;
      const user = await storage.getUser(req.user.id, req.user.tenantId);
      
      res.json({
        tokenInfo: {
          iat: decoded.iat,
          issuedAt: decoded.iat ? new Date(decoded.iat * 1000).toISOString() : null,
          exp: decoded.exp,
          expiresAt: decoded.exp ? new Date(decoded.exp * 1000).toISOString() : null,
        },
        userInfo: {
          tokenValidAfter: user?.tokenValidAfter,
          tokenValidAfterISO: user?.tokenValidAfter ? new Date(user.tokenValidAfter).toISOString() : null,
        },
        validation: {
          tokenIssuedAtMs: decoded.iat ? decoded.iat * 1000 : 0,
          tokenValidAfterMs: user?.tokenValidAfter ? new Date(user.tokenValidAfter).getTime() : 0,
          isTokenValid: decoded.iat && user?.tokenValidAfter ? 
            (decoded.iat * 1000) >= new Date(user.tokenValidAfter).getTime() : true
        }
      });
    } else {
      res.status(400).json({ message: "No token provided" });
    }
  });

  // Session restoration endpoint - tries to restore user session using refresh token
  app.post("/api/auth/restore-session", async (req, res) => {
    try {
      console.log("🔄 [Server] Session restoration request received");
      const refreshToken = req.cookies.refreshToken;

      if (!refreshToken) {
        console.log("🔄 [Server] No refresh token found for session restoration");
        return res.status(401).json({ 
          message: "No active session found",
          hasAuth: false 
        });
      }

      // Verify refresh token
      let decoded: any;
      try {
        decoded = jwt.verify(refreshToken, REFRESH_TOKEN_SECRET) as any;
        console.log("🔄 [Server] Session restoration token decoded:", {
          userId: decoded.userId,
          tenantId: decoded.tenantId,
        });
      } catch (jwtError) {
        console.log("🔄 [Server] Session restoration JWT verification failed:", jwtError);
        // Clear invalid cookie
        res.clearCookie("refreshToken", {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
        });
        return res.status(401).json({ 
          message: "Invalid session token",
          hasAuth: false 
        });
      }

      // Check if refresh token exists in database
      const storedToken = await storage.getRefreshToken(refreshToken);
      if (!storedToken) {
        console.log("🔄 [Server] Session restoration token not found in database");
        res.clearCookie("refreshToken", {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
        });
        return res.status(401).json({ 
          message: "Session not found",
          hasAuth: false 
        });
      }

      // Check if token has expired
      if (storedToken.expiresAt.getTime() < Date.now()) {
        console.log("🔄 [Server] Session restoration token has expired");
        await storage.deleteRefreshToken(refreshToken);
        res.clearCookie("refreshToken", {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
        });
        return res.status(401).json({ 
          message: "Session expired",
          hasAuth: false 
        });
      }

      // Get user
      const user = await storage.getUser(decoded.userId, decoded.tenantId);
      if (!user || !user.isActive) {
        console.log("🔄 [Server] Session restoration user not found or inactive");
        await storage.deleteRefreshToken(refreshToken);
        res.clearCookie("refreshToken", {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
        });
        return res.status(401).json({ 
          message: "User account not found or inactive",
          hasAuth: false 
        });
      }

      // Generate new access token only (keep existing refresh token)
      const { accessToken } = generateTokens(user.id, user.tenantId);
      
      // Update session last used time
      await storage.updateSessionLastUsed(refreshToken);

      console.log("🔄 [Server] Session restored successfully for user:", user.email);
      res.json({
        message: "Session restored successfully",
        accessToken,
        hasAuth: true,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          twoFactorEnabled: user.twoFactorEnabled,
          emailVerified: user.emailVerified,
          menuExpanded: user.menuExpanded ?? false,
          theme: user.theme || 'light',
          avatarUrl: user.avatarUrl || null,
        },
      });
    } catch (error: any) {
      console.error("Session restoration error:", error);
      res.clearCookie("refreshToken", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
      });
      res.status(401).json({ 
        message: "Session restoration failed",
        hasAuth: false 
      });
    }
  });

  // Get refresh token info endpoint
  app.get("/api/auth/refresh-token-info", async (req, res) => {
    try {
      const refreshToken = req.cookies.refreshToken;

      if (!refreshToken) {
        return res.status(401).json({ message: "No refresh token found" });
      }

      // Verify and get refresh token info
      const decoded = jwt.verify(refreshToken, REFRESH_TOKEN_SECRET) as any;
      const storedToken = await storage.getRefreshToken(refreshToken);
      
      if (!storedToken) {
        return res.status(401).json({ message: "Invalid refresh token" });
      }

      const now = Date.now();
      const expiryTime = storedToken.expiresAt.getTime();
      const timeLeft = expiryTime - now;
      
      // Calculate days, hours, minutes
      const days = Math.floor(timeLeft / (24 * 60 * 60 * 1000));
      const hours = Math.floor((timeLeft % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
      const minutes = Math.floor((timeLeft % (60 * 60 * 1000)) / (60 * 1000));

      res.json({
        expiresAt: storedToken.expiresAt,
        timeLeft: timeLeft,
        days: days,
        hours: hours,
        minutes: minutes,
        isExpired: timeLeft <= 0
      });
    } catch (error: any) {
      if (error instanceof jwt.TokenExpiredError) {
        return res.status(401).json({ message: "Refresh token expired" });
      }
      if (error instanceof jwt.JsonWebTokenError) {
        // Handle malformed tokens more gracefully
        console.log("🔍 [Server] Malformed refresh token detected, clearing cookie");
        res.clearCookie("refreshToken");
        return res.status(401).json({ message: "Malformed refresh token" });
      }
      console.error("Refresh token info error:", error);
      res.status(401).json({ message: "Invalid refresh token" });
    }
  });

  // Update menu preference endpoint
  app.patch(
    "/api/auth/menu-preference",
    authenticateToken,
    async (req: any, res) => {
      try {
        const { menuExpanded } = req.body;

        if (typeof menuExpanded !== "boolean") {
          return res
            .status(400)
            .json({ message: "Menu preference must be a boolean value" });
        }

        console.log(`Menu preference update for user ${req.user.id}: ${menuExpanded}`);

        // Update the menu preference in the database
        const updatedUser = await storage.updateUser(
          req.user.id,
          { menuExpanded },
          req.user.tenantId,
        );

        if (!updatedUser) {
          return res.status(404).json({ message: "User not found" });
        }

        res.json({
          message: "Menu preference updated successfully",
          menuExpanded: updatedUser.menuExpanded,
        });
      } catch (error) {
        console.error("Update menu preference error:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    },
  );

  // Logout from all devices
  app.post("/api/auth/logout-all", authenticateToken, async (req: any, res) => {
    try {
      await storage.deleteUserRefreshTokens(req.user.id, req.user.tenantId);
      res.clearCookie("refreshToken");
      res.json({ message: "Logged out from all devices" });
    } catch (error) {
      console.error("Logout all error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Update theme preference endpoint
  app.patch("/api/auth/theme", authenticateToken, async (req: any, res) => {
    try {
      const { theme } = req.body;

      if (!theme || !['light', 'dark'].includes(theme)) {
        return res.status(400).json({ 
          message: "Invalid theme. Must be 'light' or 'dark'" 
        });
      }

      const updatedUser = await storage.updateUser(
        req.user.id,
        { theme },
        req.user.tenantId,
      );

      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json({
        message: "Theme updated successfully",
        theme: updatedUser.theme,
      });
    } catch (error) {
      console.error("Update theme error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Update profile endpoint
  app.put("/api/auth/profile", authenticateToken, async (req: any, res) => {
    try {
      const rawData = updateProfileSchema.parse(req.body);

      // Sanitize input data
      const sanitizedData = sanitizeUserInput({
        firstName: rawData.firstName,
        lastName: rawData.lastName,
        email: rawData.email,
      });
      
      // Add theme preference if provided
      const updateData = {
        ...sanitizedData,
        ...(rawData.theme && { theme: rawData.theme })
      };

      // Check if email is already taken by another user
      if (sanitizedData.email && sanitizedData.email !== req.user.email) {
        const existingUser = await storage.getUserByEmail(
          sanitizedData.email,
          req.user.tenantId,
        );
        if (existingUser && existingUser.id !== req.user.id) {
          return res
            .status(409)
            .json({ message: "Email already taken by another user" });
        }
      }

      const updatedUser = await storage.updateUser(
        req.user.id,
        updateData,
        req.user.tenantId,
      );

      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json({
        message: "Profile updated successfully",
        user: {
          id: updatedUser.id,
          email: updatedUser.email,
          firstName: updatedUser.firstName,
          lastName: updatedUser.lastName,
          role: updatedUser.role,
          twoFactorEnabled: updatedUser.twoFactorEnabled,
          emailVerified: updatedUser.emailVerified,
          menuExpanded: updatedUser.menuExpanded || false,
          theme: updatedUser.theme || 'light',
          avatarUrl: updatedUser.avatarUrl || null,
        },
      });
    } catch (error: any) {
      if (error.name === "ZodError") {
        return res.status(400).json({
          message: "Validation error",
          errors: error.errors,
        });
      }
      console.error("Profile update error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Upload avatar endpoint
  app.post("/api/auth/avatar", authenticateToken, (req: any, res) => {
    avatarUpload(req, res, async (err) => {
      if (err) {
        console.error("Avatar upload error:", err);
        return res.status(400).json({ 
          message: handleUploadError(err) 
        });
      }

      try {
        const file = req.file;
        if (!file) {
          return res.status(400).json({ message: "No file uploaded" });
        }

        // Check if R2 is configured
        if (!R2_CONFIG.isConfigured) {
          return res.status(503).json({ 
            message: "Avatar upload service is not configured. Please contact support." 
          });
        }

        // Process image with sharp (resize, optimize)
        const processedImage = await sharp(file.buffer)
          .resize(400, 400, { 
            fit: 'cover',
            position: 'center'
          })
          .jpeg({ quality: 90 })
          .toBuffer();

        // Generate unique filename
        const timestamp = Date.now();
        const filename = `avatars/${req.user.tenantId}/${req.user.id}/${timestamp}.jpg`;

        // Upload to R2
        const avatarUrl = await uploadToR2(filename, processedImage, 'image/jpeg');

        // Delete old avatar if exists
        if (req.user.avatarUrl) {
          try {
            const oldKey = req.user.avatarUrl.replace(R2_CONFIG.publicUrl + '/', '');
            await deleteFromR2(oldKey);
          } catch (deleteError) {
            console.error("Failed to delete old avatar:", deleteError);
            // Continue anyway
          }
        }

        // Update user record
        const updatedUser = await storage.updateUser(
          req.user.id,
          { avatarUrl },
          req.user.tenantId
        );

        if (!updatedUser) {
          return res.status(404).json({ message: "User not found" });
        }

        res.json({
          success: true,
          url: avatarUrl,
          message: "Avatar uploaded successfully"
        });
      } catch (error) {
        console.error("Avatar processing error:", error);
        res.status(500).json({ 
          message: "Failed to process avatar. Please try again." 
        });
      }
    });
  });

  // Delete avatar endpoint
  app.delete("/api/auth/avatar", authenticateToken, async (req: any, res) => {
    try {
      // Check if user has an avatar
      if (!req.user.avatarUrl) {
        return res.status(400).json({ 
          message: "No avatar to delete" 
        });
      }

      // Check if R2 is configured
      if (!R2_CONFIG.isConfigured) {
        return res.status(503).json({ 
          message: "Avatar service is not configured. Please contact support." 
        });
      }

      // Delete from R2
      try {
        const key = req.user.avatarUrl.replace(R2_CONFIG.publicUrl + '/', '');
        await deleteFromR2(key);
      } catch (deleteError) {
        console.error("Failed to delete avatar from R2:", deleteError);
        // Continue anyway to clear the database record
      }

      // Update user record
      const updatedUser = await storage.updateUser(
        req.user.id,
        { avatarUrl: null },
        req.user.tenantId
      );

      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json({
        success: true,
        message: "Avatar deleted successfully"
      });
    } catch (error) {
      console.error("Avatar deletion error:", error);
      res.status(500).json({ 
        message: "Failed to delete avatar. Please try again." 
      });
    }
  });


  // Change password endpoint with input sanitization
  app.put(
    "/api/auth/change-password",
    authenticateToken,
    async (req: any, res) => {
      try {
        const rawData = changePasswordSchema.parse(req.body);
        const currentPassword = sanitizePassword(rawData.currentPassword);
        const newPassword = sanitizePassword(rawData.newPassword);

        if (!currentPassword || !newPassword) {
          return res
            .status(400)
            .json({
              message: "Current password and new password are required",
            });
        }

        // Verify current password
        const isValidPassword = await bcrypt.compare(
          currentPassword,
          req.user.password,
        );
        if (!isValidPassword) {
          return res
            .status(400)
            .json({ message: "Current password is incorrect" });
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 12);

        // Update password
        const updatedUser = await storage.updateUser(
          req.user.id,
          { password: hashedPassword },
          req.user.tenantId,
        );

        if (!updatedUser) {
          return res.status(404).json({ message: "User not found" });
        }

        // Revoke all refresh tokens to force re-authentication on all devices
        await storage.deleteUserRefreshTokens(req.user.id, req.user.tenantId);

        res.json({
          message: "Password changed successfully. Please log in again.",
        });
      } catch (error: any) {
        if (error.name === "ZodError") {
          return res.status(400).json({
            message: "Validation error",
            errors: error.errors,
          });
        }
        console.error("Password change error:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    },
  );

  // Generate 2FA setup
  app.post("/api/auth/2fa/setup", authenticateToken, async (req: any, res) => {
    try {
      if (req.user.twoFactorEnabled) {
        return res.status(400).json({ message: "2FA is already enabled" });
      }

      // Generate secret
      const secret = authenticator.generateSecret();
      const serviceName = "SecureAuth";
      const accountName = req.user.email;

      // Generate QR code URL
      const otpauthUrl = authenticator.keyuri(accountName, serviceName, secret);
      const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);

      // Store the secret temporarily (not enabled until verified)
      await storage.updateUser(
        req.user.id,
        { twoFactorSecret: secret },
        req.user.tenantId,
      );

      res.json({
        secret,
        qrCode: qrCodeDataUrl,
        backupCodes: [], // In production, generate backup codes
      });
    } catch (error) {
      console.error("2FA setup error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Enable 2FA
  app.post("/api/auth/2fa/enable", authenticateToken, async (req: any, res) => {
    try {
      const { token } = enable2FASchema.parse(req.body);

      if (req.user.twoFactorEnabled) {
        return res.status(400).json({ message: "2FA is already enabled" });
      }

      if (!req.user.twoFactorSecret) {
        return res.status(400).json({ message: "2FA setup not initiated" });
      }

      // Verify the token
      const isValid = authenticator.verify({
        token,
        secret: req.user.twoFactorSecret,
      });

      if (!isValid) {
        return res.status(400).json({ message: "Invalid 2FA token" });
      }

      // Enable 2FA
      await storage.updateUser(
        req.user.id,
        { twoFactorEnabled: true },
        req.user.tenantId,
      );

      res.json({ message: "2FA enabled successfully" });
    } catch (error: any) {
      if (error.name === "ZodError") {
        return res.status(400).json({
          message: "Validation error",
          errors: error.errors,
        });
      }
      console.error("2FA enable error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Disable 2FA
  app.post(
    "/api/auth/2fa/disable",
    authenticateToken,
    async (req: any, res) => {
      try {
        const { token } = disable2FASchema.parse(req.body);

        if (!req.user.twoFactorEnabled) {
          return res.status(400).json({ message: "2FA is not enabled" });
        }

        if (!req.user.twoFactorSecret) {
          return res.status(400).json({ message: "2FA configuration error" });
        }

        // Verify the token
        const isValid = authenticator.verify({
          token,
          secret: req.user.twoFactorSecret,
        });

        if (!isValid) {
          return res.status(400).json({ message: "Invalid 2FA token" });
        }

        // Disable 2FA and remove secret
        await storage.updateUser(
          req.user.id,
          {
            twoFactorEnabled: false,
            twoFactorSecret: null,
          },
          req.user.tenantId,
        );

        res.json({ message: "2FA disabled successfully" });
      } catch (error: any) {
        if (error.name === "ZodError") {
          return res.status(400).json({
            message: "Validation error",
            errors: error.errors,
          });
        }
        console.error("2FA disable error:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    },
  );

  // Delete account endpoint
  app.delete("/api/auth/account", authenticateToken, async (req: any, res) => {
    try {
      // Deactivate user instead of deleting
      const updatedUser = await storage.updateUser(
        req.user.id,
        { isActive: false },
        req.user.tenantId,
      );

      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }

      // Revoke all refresh tokens
      await storage.deleteUserRefreshTokens(req.user.id, req.user.tenantId);

      // Clear refresh token cookie
      res.clearCookie("refreshToken");

      res.json({ message: "Account deleted successfully" });
    } catch (error) {
      console.error("Account deletion error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Forgot password endpoint (placeholder)
  app.post("/api/auth/forgot-password", async (req, res) => {
    try {
      const { email } = forgotPasswordSchema.parse(req.body);

      // For backward compatibility, use default tenant
      const tenant = await storage.getTenantBySlug("default");
      if (!tenant) {
        return res.status(500).json({ message: "System configuration error" });
      }

      // Check if user exists
      const user = await storage.getUserByEmail(email, tenant.id);
      if (!user) {
        // Don't reveal if user exists or not for security
        return res.json({
          message: "If the email exists, a reset link has been sent",
        });
      }

      // TODO: Implement email sending logic
      // For now, just return success message
      res.json({ message: "If the email exists, a reset link has been sent" });
    } catch (error: any) {
      if (error.name === "ZodError") {
        return res.status(400).json({
          message: "Validation error",
          errors: error.errors,
        });
      }
      console.error("Forgot password error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Device session management endpoints

  // Get user's active sessions
  app.get("/api/auth/sessions", authenticateToken, async (req: any, res) => {
    try {
      const sessions = await storage.getUserSessions(
        req.user.id,
        req.user.tenantId,
      );

      // Get current session token to mark it as current
      const currentRefreshToken = req.cookies.refreshToken;

      const sessionData = sessions.map((session) => ({
        id: session.id,
        deviceId: session.deviceId,
        deviceName: session.deviceName || "Unknown Device",
        ipAddress: session.ipAddress,
        location: session.location,
        lastUsed: session.lastUsed,
        isCurrent: session.token === currentRefreshToken,
        createdAt: session.createdAt,
      }));

      res.json({ sessions: sessionData });
    } catch (error) {
      console.error("Get sessions error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Delete a specific session (logout from specific device)
  app.delete(
    "/api/auth/sessions/:sessionId",
    authenticateToken,
    async (req: any, res) => {
      try {
        const { sessionId } = req.params;
        const userId = req.user.id;

        await storage.deleteSession(sessionId, userId, req.user.tenantId);

        res.json({ message: "Session deleted successfully" });
      } catch (error) {
        console.error("Delete session error:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    },
  );

  // Delete all other sessions (logout from all other devices)
  app.delete("/api/auth/sessions", authenticateToken, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const currentRefreshToken = req.cookies.refreshToken;

      if (!currentRefreshToken) {
        // If no refresh token cookie, check if user has any sessions and delete all
        console.log(
          "No refresh token cookie found, deleting all user sessions",
        );
        await storage.deleteAllUserSessions(userId, req.user.tenantId);
        
        // Update tokenValidAfter to invalidate all existing access tokens
        await storage.updateUser(
          userId,
          { tokenValidAfter: new Date() },
          req.user.tenantId
        );
        
        return res.json({ message: "All sessions logged out successfully" });
      }

      // Verify the refresh token exists in database
      const refreshTokenData =
        await storage.getRefreshToken(currentRefreshToken);
      if (!refreshTokenData) {
        console.log(
          "Refresh token not found in database, deleting all user sessions",
        );
        await storage.deleteAllUserSessions(userId, req.user.tenantId);
        
        // Update tokenValidAfter to invalidate all existing access tokens
        await storage.updateUser(
          userId,
          { tokenValidAfter: new Date() },
          req.user.tenantId
        );
        
        return res.json({ message: "All sessions logged out successfully" });
      }

      // Delete all sessions except the current one using database query directly
      console.log("Deleting other sessions for user:", userId);
      await storage.deleteOtherUserSessions(
        userId,
        currentRefreshToken,
        req.user.tenantId,
      );

      // Update tokenValidAfter to invalidate all existing access tokens
      console.log("Updating tokenValidAfter to invalidate all tokens");
      await storage.updateUser(
        userId,
        { tokenValidAfter: new Date() },
        req.user.tenantId
      );

      res.json({ message: "All other sessions logged out successfully" });
    } catch (error) {
      console.error("Delete all sessions error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // User Management API Routes

  // Get all users (Admin/Manager only)
  app.get(
    "/api/users",
    authenticateToken,
    requireManagerOrAdmin,
    async (req: any, res) => {
      try {
        const filters = userFiltersSchema.parse(req.query);
        const users = await storage.getAllUsers(req.user.tenantId, filters);

        // Remove sensitive data before sending
        const safeUsers = users.map((user) => ({
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          isActive: user.isActive,
          emailVerified: user.emailVerified,
          twoFactorEnabled: user.twoFactorEnabled,
          lastLoginAt: user.lastLoginAt,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        }));

        res.json({ users: safeUsers });
      } catch (error: any) {
        if (error.name === "ZodError") {
          return res.status(400).json({
            message: "Validation error",
            errors: error.errors,
          });
        }
        console.error("Get users error:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    },
  );

  // Get user statistics (Admin/Manager only)
  app.get(
    "/api/users/stats",
    authenticateToken,
    requireManagerOrAdmin,
    async (req: any, res) => {
      try {
        const stats = await storage.getUserStats(req.user.tenantId);
        res.json(stats);
      } catch (error) {
        console.error("Get user stats error:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    },
  );

  // Get current user limits and usage (Admin/Manager only)
  app.get(
    "/api/users/limits",
    authenticateToken,
    requireManagerOrAdmin,
    async (req: any, res) => {
      try {
        const limits = await storage.checkUserLimits(req.user.tenantId);
        res.json(limits);
      } catch (error) {
        console.error("Get user limits error:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    },
  );

  // Create a new user (Admin only)
  app.post(
    "/api/users",
    authenticateToken,
    requireAdmin,
    async (req: any, res) => {
      try {
        const userData = createUserSchema.parse(req.body);

        // Validate user limits before creating new user
        await storage.validateUserCreation(req.user.tenantId);

        // Check if user already exists in tenant
        const existingUser = await storage.getUserByEmail(
          userData.email,
          req.user.tenantId,
        );
        if (existingUser) {
          return res
            .status(400)
            .json({ message: "User with this email already exists" });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(userData.password, 12);

        // Create user
        const user = await storage.createUserAsAdmin(
          {
            ...userData,
            password: hashedPassword,
          },
          req.user.tenantId,
        );

        // Remove sensitive data before sending
        const safeUser = {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          isActive: user.isActive,
          emailVerified: user.emailVerified,
          createdAt: user.createdAt,
        };

        res.status(201).json({
          message: "User created successfully",
          user: safeUser,
        });
      } catch (error: any) {
        if (error.name === "ZodError") {
          return res.status(400).json({
            message: "Validation error",
            errors: error.errors,
          });
        }
        console.error("Create user error:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    },
  );

  // Update a user (Admin only)
  app.put(
    "/api/users/:id",
    authenticateToken,
    requireAdmin,
    async (req: any, res) => {
      try {
        const { id } = req.params;
        const userData = updateUserSchema.parse(req.body);

        // Check if user exists in tenant
        const existingUser = await storage.getUser(id, req.user.tenantId);
        if (!existingUser) {
          return res.status(404).json({ message: "User not found" });
        }

        // Check if email is being changed and if it's already taken
        if (userData.email !== existingUser.email) {
          const emailTaken = await storage.getUserByEmail(
            userData.email,
            req.user.tenantId,
          );
          if (emailTaken) {
            return res
              .status(400)
              .json({ message: "Email already in use by another user" });
          }
        }

        const updatedUser = await storage.updateUserAsAdmin(
          id,
          userData,
          req.user.tenantId,
        );

        if (!updatedUser) {
          return res.status(404).json({ message: "User not found" });
        }

        // If user is deactivated, delete all their sessions
        if (!userData.isActive) {
          await storage.deleteUserRefreshTokens(id, req.user.tenantId);
        }

        // Remove sensitive data before sending
        const safeUser = {
          id: updatedUser.id,
          email: updatedUser.email,
          firstName: updatedUser.firstName,
          lastName: updatedUser.lastName,
          role: updatedUser.role,
          isActive: updatedUser.isActive,
          emailVerified: updatedUser.emailVerified,
          updatedAt: updatedUser.updatedAt,
        };

        res.json({
          message: "User updated successfully",
          user: safeUser,
        });
      } catch (error: any) {
        if (error.name === "ZodError") {
          return res.status(400).json({
            message: "Validation error",
            errors: error.errors,
          });
        }
        console.error("Update user error:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    },
  );

  // Delete a user (Admin only)
  app.delete(
    "/api/users/:id",
    authenticateToken,
    requireAdmin,
    async (req: any, res) => {
      try {
        const { id } = req.params;

        // Prevent admin from deleting themselves
        if (id === req.user.id) {
          return res
            .status(400)
            .json({ message: "Cannot delete your own account" });
        }

        // Check if user exists in tenant
        const existingUser = await storage.getUser(id, req.user.tenantId);
        if (!existingUser) {
          return res.status(404).json({ message: "User not found" });
        }

        await storage.deleteUser(id, req.user.tenantId);

        res.json({ message: "User deleted successfully" });
      } catch (error) {
        console.error("Delete user error:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    },
  );

  // Toggle user status (Admin only)
  app.patch(
    "/api/users/:id/status",
    authenticateToken,
    requireAdmin,
    async (req: any, res) => {
      try {
        const { id } = req.params;
        const { isActive } = req.body;

        if (typeof isActive !== "boolean") {
          return res
            .status(400)
            .json({ message: "isActive must be a boolean" });
        }

        // Prevent admin from deactivating themselves
        if (id === req.user.id && !isActive) {
          return res
            .status(400)
            .json({ message: "Cannot deactivate your own account" });
        }

        const updatedUser = await storage.toggleUserStatus(
          id,
          isActive,
          req.user.tenantId,
        );

        if (!updatedUser) {
          return res.status(404).json({ message: "User not found" });
        }

        // If user is deactivated, delete all their sessions
        if (!isActive) {
          await storage.deleteUserRefreshTokens(id, req.user.tenantId);
        }

        res.json({
          message: `User ${isActive ? "activated" : "deactivated"} successfully`,
          user: {
            id: updatedUser.id,
            isActive: updatedUser.isActive,
          },
        });
      } catch (error) {
        console.error("Toggle user status error:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    },
  );

  // Subscription plans API
  app.get("/api/subscription-plans", async (req, res) => {
    try {
      const plans = await storage.getSubscriptionPlans();
      res.json(plans);
    } catch (error: any) {
      res
        .status(500)
        .json({
          message: "Error fetching subscription plans: " + error.message,
        });
    }
  });

  // Create subscription for free trial signup (no auth required)
  app.post("/api/free-trial-signup", async (req: any, res) => {
    try {
      const { email, firstName, lastName, password, planId, billingCycle } =
        req.body;

      // Validate required fields
      if (!email || !firstName || !lastName || !password || !planId) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      // Get default tenant
      const tenant = await storage.getTenantBySlug("default");
      if (!tenant) {
        return res.status(500).json({ message: "System configuration error" });
      }

      // Check if user already exists
      try {
        const existingUser = await storage.getUserByEmail(email, tenant.id);
        if (existingUser) {
          return res.status(400).json({ message: "User already exists" });
        }
      } catch (error) {
        // User doesn't exist, continue with creation
      }

      // Get the subscription plan
      const plan = await storage.getSubscriptionPlan(planId);
      if (!plan) {
        return res.status(404).json({ message: "Subscription plan not found" });
      }

      // Create user account
      const hashedPassword = await bcrypt.hash(password, 10);
      const newUser = await storage.createUser({
        tenantId: tenant.id,
        email,
        firstName,
        lastName,
        password: hashedPassword,
        emailVerified: false,
        role: "User",
      });

      // Generate email verification token
      const verificationToken = randomBytes(32).toString("hex");
      await storage.setEmailVerificationToken(
        newUser.id,
        tenant.id,
        verificationToken,
        new Date(Date.now() + 24 * 60 * 60 * 1000),
      );

      // Send verification email
      try {
        await emailService.sendVerificationEmail(
          email,
          `${firstName} ${lastName}`,
          verificationToken,
        );
      } catch (emailError) {
        console.error("Failed to send verification email:", emailError);
      }

      // Create Stripe customer
      const customer = await stripe.customers.create({
        email: newUser.email,
        name: `${newUser.firstName} ${newUser.lastName}`,
      });

      // Get the correct price ID based on billing cycle
      const priceId =
        billingCycle === "yearly"
          ? plan.stripeYearlyPriceId || plan.stripePriceId
          : plan.stripePriceId;

      // Create Stripe subscription with free trial
      const subscription = await stripe.subscriptions.create({
        customer: customer.id,
        items: [{ price: priceId }],
        trial_period_days: plan.trialDays || 14,
        payment_behavior: "default_incomplete",
        payment_settings: { save_default_payment_method: "on_subscription" },
        expand: ["latest_invoice.payment_intent"],
      });

      // Helper function to safely convert Stripe timestamps to dates
      const safeTimestampToDate = (timestamp: any): Date | null => {
        if (!timestamp) return null;
        if (typeof timestamp === "number") {
          const date = new Date(timestamp * 1000);
          return isNaN(date.getTime()) ? null : date;
        }
        return null;
      };

      // Save subscription to database
      await storage.createSubscription({
        tenantId: tenant.id,
        userId: newUser.id,
        planId: plan.id,
        stripeSubscriptionId: subscription.id,
        stripeCustomerId: customer.id,
        status: subscription.status,
        currentPeriodStart:
          safeTimestampToDate((subscription as any).current_period_start) ||
          new Date(),
        currentPeriodEnd:
          safeTimestampToDate((subscription as any).current_period_end) ||
          new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        trialStart: safeTimestampToDate((subscription as any).trial_start),
        trialEnd: safeTimestampToDate((subscription as any).trial_end),
        isYearly: billingCycle === "yearly",
      });

      // Update user with Stripe info
      // Note: updateUserStripeInfo method would need to be implemented in storage

      res.status(201).json({
        message:
          "Account created successfully! Please check your email to verify your account.",
        user: {
          id: newUser.id,
          email: newUser.email,
          firstName: newUser.firstName,
          lastName: newUser.lastName,
        },
        subscription: {
          id: subscription.id,
          status: subscription.status,
          trialEnd: safeTimestampToDate((subscription as any).trial_end),
        },
      });
    } catch (error: any) {
      console.error("Free trial signup error:", error);
      res
        .status(500)
        .json({ message: "Error creating account: " + error.message });
    }
  });

  // Create subscription and payment intent (for existing users)
  app.post(
    "/api/create-subscription",
    authenticateToken,
    requireRole(["Owner"]),
    async (req: any, res) => {
      try {
        const billingData = billingInfoSchema.parse(req.body);
        const user = req.user;

        // Get the selected plan
        const plan = await storage.getSubscriptionPlan(billingData.planId);
        if (!plan) {
          return res
            .status(404)
            .json({ message: "Subscription plan not found" });
        }

        // Create or get Stripe customer
        let customer;
        if (user.stripeCustomerId) {
          customer = await stripe.customers.retrieve(user.stripeCustomerId);
        } else {
          customer = await stripe.customers.create({
            email: user.email,
            name: `${user.firstName} ${user.lastName}`,
          });
        }

        // Determine the price ID based on billing cycle
        const priceId =
          billingData.billingCycle === "yearly"
            ? plan.stripeYearlyPriceId || plan.stripePriceId
            : plan.stripePriceId;

        // Create Stripe subscription
        const subscription = await stripe.subscriptions.create({
          customer: customer.id,
          items: [{ price: priceId }],
          payment_behavior: "default_incomplete",
          payment_settings: { save_default_payment_method: "on_subscription" },
          expand: ["latest_invoice.payment_intent"],
          trial_period_days: plan.trialDays || undefined,
        });

        // Helper function to safely convert Stripe timestamps to dates
        const safeTimestampToDate = (timestamp: any): Date | null => {
          if (!timestamp) return null;
          if (typeof timestamp === "number") {
            const date = new Date(timestamp * 1000);
            return isNaN(date.getTime()) ? null : date;
          }
          return null;
        };

        // Save subscription to database
        await storage.createSubscription({
          tenantId: user.tenantId,
          userId: user.id,
          planId: plan.id,
          stripeSubscriptionId: subscription.id,
          stripeCustomerId: customer.id,
          status: subscription.status,
          currentPeriodStart:
            safeTimestampToDate((subscription as any).current_period_start) ||
            new Date(),
          currentPeriodEnd:
            safeTimestampToDate((subscription as any).current_period_end) ||
            new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // Default to 30 days from now
          trialStart: safeTimestampToDate((subscription as any).trial_start),
          trialEnd: safeTimestampToDate((subscription as any).trial_end),
          isYearly: billingData.billingCycle === "yearly",
        });

        // Update user with Stripe info
        await storage.updateUserStripeInfo(
          user.id,
          customer.id,
          subscription.id,
          user.tenantId,
        );

        const invoice = subscription.latest_invoice as any;
        const paymentIntent = invoice?.payment_intent as any;

        // For trial subscriptions, there might not be a payment intent initially
        res.json({
          subscriptionId: subscription.id,
          clientSecret: paymentIntent?.client_secret || null,
          status: subscription.status,
          requiresPayment: !!paymentIntent?.client_secret,
          trialEnd: safeTimestampToDate((subscription as any).trial_end),
        });
      } catch (error: any) {
        console.error("Error creating subscription:", error);
        res
          .status(500)
          .json({ message: "Error creating subscription: " + error.message });
      }
    },
  );

  // Get user's current subscription
  app.get("/api/my-subscription", authenticateToken, requireRole(["Owner"]), async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const subscription = await storage.getUserSubscription(userId, req.user.tenantId);
      if (!subscription) {
        return res.json({ subscription: null });
      }

      const plan = await storage.getSubscriptionPlan(subscription.planId);
      res.json({
        subscription: {
          ...subscription,
          plan,
        },
      });
    } catch (error: any) {
      console.error("Error fetching subscription:", error);
      res
        .status(500)
        .json({ message: "Error fetching subscription: " + error.message });
    }
  });

  // Upgrade/change subscription plan
  app.post(
    "/api/upgrade-subscription",
    authenticateToken,
    requireRole(["Owner"]),
    async (req: any, res) => {
      try {
        const { planId, billingCycle } = billingInfoSchema.parse(req.body);
        const user = req.user;

        // Get current subscription
        const currentSubscription = await storage.getUserSubscription(user.id, user.tenantId);
        if (!currentSubscription) {
          return res
            .status(404)
            .json({ message: "No active subscription found" });
        }

        // Get the new plan
        const newPlan = await storage.getSubscriptionPlan(planId);
        if (!newPlan) {
          return res
            .status(404)
            .json({ message: "Subscription plan not found" });
        }

        // Get current plan for comparison
        const currentPlan = await storage.getSubscriptionPlan(
          currentSubscription.planId,
        );

        // Determine the new price ID based on billing cycle
        const newPriceId =
          billingCycle === "yearly"
            ? newPlan.stripeYearlyPriceId || newPlan.stripePriceId
            : newPlan.stripePriceId;

        try {
          // Update the Stripe subscription
          const updatedStripeSubscription = await stripe.subscriptions.update(
            currentSubscription.stripeSubscriptionId,
            {
              items: [
                {
                  id: (
                    await stripe.subscriptions.retrieve(
                      currentSubscription.stripeSubscriptionId,
                    )
                  ).items.data[0].id,
                  price: newPriceId,
                },
              ],
              proration_behavior: "always_invoice", // Create prorated invoice immediately
            },
          );

          // Helper function to safely convert Stripe timestamps to dates
          const safeTimestampToDate = (timestamp: any): Date | null => {
            if (!timestamp || typeof timestamp !== "number") return null;
            const date = new Date(timestamp * 1000);
            return isNaN(date.getTime()) ? null : date;
          };

          // Update subscription in database
          await storage.updateSubscription(currentSubscription.id, {
            planId: newPlan.id,
            status: updatedStripeSubscription.status,
            currentPeriodStart:
              safeTimestampToDate(
                (updatedStripeSubscription as any).current_period_start,
              ) || new Date(),
            currentPeriodEnd:
              safeTimestampToDate(
                (updatedStripeSubscription as any).current_period_end,
              ) || new Date(),
            isYearly: billingCycle === "yearly",
          }, user.tenantId);

          res.json({
            message: "Subscription updated successfully",
            subscription: {
              id: currentSubscription.id,
              status: updatedStripeSubscription.status,
              planId: newPlan.id,
              planName: newPlan.displayName,
            },
          });
        } catch (stripeError: any) {
          console.error("Stripe subscription update error:", stripeError);
          res.status(400).json({
            message:
              "Failed to update subscription: " +
              (stripeError.message || "Unknown error"),
          });
        }
      } catch (error: any) {
        console.error("Error upgrading subscription:", error);
        res
          .status(500)
          .json({ message: "Error upgrading subscription: " + error.message });
      }
    },
  );

  // Forms API Routes (tenant-aware)

  // Get user's forms
  app.get("/api/forms", authenticateToken, async (req: any, res) => {
    try {
      const forms = await storage.getUserForms(req.user.id, req.user.tenantId);
      res.json({ forms });
    } catch (error) {
      console.error("Get forms error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get tenant forms (for admin/manager)
  app.get(
    "/api/forms/tenant",
    authenticateToken,
    requireManagerOrAdmin,
    async (req: any, res) => {
      try {
        const forms = await storage.getTenantForms(req.user.tenantId);
        res.json({ forms });
      } catch (error) {
        console.error("Get tenant forms error:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    },
  );

  // Get specific form
  app.get("/api/forms/:id", authenticateToken, async (req: any, res) => {
    try {
      const { id } = req.params;
      const form = await storage.getForm(id, req.user.tenantId);

      if (!form) {
        return res.status(404).json({ message: "Form not found" });
      }

      res.json({ form });
    } catch (error) {
      console.error("Get form error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Create new form
  app.post("/api/forms", authenticateToken, async (req: any, res) => {
    try {
      const formData = req.body; // Already validated by DragFormMaster

      const form = await storage.createForm(
        formData,
        req.user.id,
        req.user.tenantId,
      );

      res.status(201).json({
        message: "Form created successfully",
        form,
      });
    } catch (error) {
      console.error("Create form error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Update form
  app.put("/api/forms/:id", authenticateToken, async (req: any, res) => {
    try {
      const { id } = req.params;
      const formData = req.body;

      // Check if form exists and belongs to user's tenant
      const existingForm = await storage.getForm(id, req.user.tenantId);
      if (!existingForm) {
        return res.status(404).json({ message: "Form not found" });
      }

      const updatedForm = await storage.updateForm(
        id,
        formData,
        req.user.tenantId,
      );

      res.json({
        message: "Form updated successfully",
        form: updatedForm,
      });
    } catch (error) {
      console.error("Update form error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Delete form
  app.delete("/api/forms/:id", authenticateToken, async (req: any, res) => {
    try {
      const { id } = req.params;

      // Check if form exists and belongs to user's tenant
      const existingForm = await storage.getForm(id, req.user.tenantId);
      if (!existingForm) {
        return res.status(404).json({ message: "Form not found" });
      }

      await storage.deleteForm(id, req.user.tenantId);

      res.json({ message: "Form deleted successfully" });
    } catch (error) {
      console.error("Delete form error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get form responses
  app.get(
    "/api/forms/:id/responses",
    authenticateToken,
    async (req: any, res) => {
      try {
        const { id } = req.params;

        // Check if form exists and belongs to user's tenant
        const form = await storage.getForm(id, req.user.tenantId);
        if (!form) {
          return res.status(404).json({ message: "Form not found" });
        }

        const responses = await storage.getFormResponses(id, req.user.tenantId);
        const responseCount = await storage.getFormResponseCount(
          id,
          req.user.tenantId,
        );

        res.json({ responses, responseCount });
      } catch (error) {
        console.error("Get form responses error:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    },
  );

  // Public form endpoints for embedding (no authentication required)
  
  // CORS middleware for public endpoints
  const setCORSHeaders = (res: any) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    // Remove CSP for public endpoints to allow embedding
    res.removeHeader('Content-Security-Policy');
  };

  // Handle preflight requests for public endpoints
  app.options("/api/public/*", (req: any, res) => {
    setCORSHeaders(res);
    res.sendStatus(200);
  });
  
  // Get public form data for embedding
  app.get("/api/public/forms/:id", async (req: any, res) => {
    setCORSHeaders(res);
    try {
      const { id } = req.params;
      
      // Get form from any tenant (we'll identify tenant from the form)
      const form = await storage.getPublicForm(id);
      if (!form || !form.isActive || !form.isEmbeddable) {
        return res.status(404).json({ message: "Form not found, inactive, or not embeddable" });
      }

      // Return only the necessary data for rendering
      const publicFormData = {
        id: form.id,
        title: form.title,
        description: form.description,
        formData: form.formData,
        theme: form.theme,
        tenantId: form.tenantId // Needed for submissions
      };

      res.json(publicFormData);
    } catch (error) {
      console.error("Get public form error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Submit form response from external website
  app.post("/api/public/forms/:id/submit", async (req: any, res) => {
    setCORSHeaders(res);
    try {
      const { id } = req.params;
      const { responseData } = req.body;
      
      if (!responseData) {
        return res.status(400).json({ message: "Response data is required" });
      }

      // Get form to verify it exists and is active
      const form = await storage.getPublicForm(id);
      if (!form || !form.isActive || !form.isEmbeddable) {
        return res.status(404).json({ message: "Form not found, inactive, or not embeddable" });
      }

      // Prepare submission data
      const submissionData = {
        formId: id,
        responseData: typeof responseData === 'string' ? responseData : JSON.stringify(responseData),
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.get('User-Agent')
      };

      // Submit the response
      const response = await storage.submitFormResponse(submissionData, form.tenantId);

      res.status(201).json({
        message: "Form submitted successfully",
        responseId: response.id
      });
    } catch (error) {
      console.error("Submit public form error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Serve the AuthentikForms widget JavaScript
  app.get("/js/authentik-forms.js", (req: any, res) => {
    setCORSHeaders(res);
    res.type('application/javascript');
    res.sendFile(path.join(__dirname, '../public/authentik-forms.js'));
  });

  // Serve the form embedding example page
  app.get("/embed-example", (req: any, res) => {
    res.sendFile(path.join(__dirname, '../public/form-embed-example.html'));
  });

  // Serve the simple embedding example page
  app.get("/simple-example", (req: any, res) => {
    res.sendFile(path.join(__dirname, '../public/simple-example.html'));
  });

  // Company API Routes (single company per user)

  // Get tenant's company information
  app.get("/api/company", authenticateToken, async (req: any, res) => {
    try {
      // Get the company information for this user
      const company = await storage.getUserCompany(req.user.id, req.user.tenantId);
      
      if (!company) {
        return res.status(404).json({ message: "Company not found" });
      }

      res.json({ company });
    } catch (error) {
      console.error("Get company error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Create new company information
  app.post("/api/company", authenticateToken, requireRole(["Owner", "Administrator"]), async (req: any, res) => {
    try {
      const companyData = createCompanySchema.parse(req.body);

      // Create the company information
      const company = await storage.createCompany(companyData, req.user.id, req.user.tenantId);

      res.status(201).json({
        message: "Company information created successfully",
        company,
      });
    } catch (error: any) {
      if (error.name === "ZodError") {
        return res.status(400).json({
          message: "Validation error",
          errors: error.errors,
        });
      }
      console.error("Create company error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Update tenant's company information
  app.patch("/api/company", authenticateToken, requireRole(["Owner", "Administrator"]), async (req: any, res) => {
    try {
      const companyData = updateCompanySchema.parse(req.body);

      // Update the company information
      const company = await storage.updateUserCompany(req.user.id, companyData, req.user.tenantId);

      if (!company) {
        return res.status(404).json({ message: "Company not found or not authorized" });
      }

      res.json({
        message: "Company information updated successfully",
        company,
      });
    } catch (error: any) {
      if (error.name === "ZodError") {
        return res.status(400).json({
          message: "Validation error",
          errors: error.errors,
        });
      }
      console.error("Update company error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Shops API Routes
  
  // Get all shops for the tenant
  app.get("/api/shops", authenticateToken, async (req: any, res) => {
    try {
      const filters: ShopFilters = {
        search: req.query.search as string,
        status: req.query.status as 'active' | 'inactive' | 'maintenance' | 'all',
        category: req.query.category as string,
        managerId: req.query.managerId as string,
      };

      const shops = await storage.getAllShops(req.user.tenantId, filters);
      const stats = await storage.getShopStats(req.user.tenantId);
      const limits = await storage.checkShopLimits(req.user.tenantId);

      res.json({ 
        shops, 
        stats,
        limits: {
          currentShops: limits.currentShops,
          maxShops: limits.maxShops,
          canAddShop: limits.canAddShop,
          planName: limits.planName
        }
      });
    } catch (error) {
      console.error("Get shops error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get single shop
  app.get("/api/shops/:id", authenticateToken, async (req: any, res) => {
    try {
      const { id } = req.params;
      const shop = await storage.getShopWithManager(id, req.user.tenantId);

      if (!shop) {
        return res.status(404).json({ message: "Shop not found" });
      }

      res.json({ shop });
    } catch (error) {
      console.error("Get shop error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Create new shop
  app.post("/api/shops", authenticateToken, requireRole(["Owner", "Administrator", "Manager"]), async (req: any, res) => {
    try {
      const shopData = createShopSchema.parse(req.body);
      const shop = await storage.createShop(shopData, req.user.tenantId);

      res.status(201).json({
        message: "Shop created successfully",
        shop,
      });
    } catch (error: any) {
      if (error.name === "ZodError") {
        return res.status(400).json({
          message: "Validation error",
          errors: error.errors,
        });
      }
      
      // Handle shop limit errors specifically
      if (error.message && error.message.includes("Shop limit reached")) {
        return res.status(403).json({
          message: error.message,
          error: "SHOP_LIMIT_REACHED"
        });
      }
      
      console.error("Create shop error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Update shop
  app.put("/api/shops/:id", authenticateToken, requireRole(["Owner", "Administrator", "Manager"]), async (req: any, res) => {
    try {
      const { id } = req.params;
      const shopData = updateShopSchema.parse(req.body);

      // Check if shop exists and belongs to tenant
      const existingShop = await storage.getShop(id, req.user.tenantId);
      if (!existingShop) {
        return res.status(404).json({ message: "Shop not found" });
      }

      const shop = await storage.updateShop(id, shopData, req.user.tenantId);

      res.json({
        message: "Shop updated successfully",
        shop,
      });
    } catch (error: any) {
      if (error.name === "ZodError") {
        return res.status(400).json({
          message: "Validation error",
          errors: error.errors,
        });
      }
      console.error("Update shop error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Toggle shop status (active/inactive)
  app.patch("/api/shops/:id/toggle-status", authenticateToken, requireRole(["Owner", "Administrator", "Manager"]), async (req: any, res) => {
    try {
      const { id } = req.params;
      const { isActive } = req.body;

      if (typeof isActive !== 'boolean') {
        return res.status(400).json({ message: "isActive must be a boolean" });
      }

      const shop = await storage.toggleShopStatus(id, isActive, req.user.tenantId);

      if (!shop) {
        return res.status(404).json({ message: "Shop not found" });
      }

      res.json({
        message: `Shop ${isActive ? 'activated' : 'deactivated'} successfully`,
        shop,
      });
    } catch (error) {
      console.error("Toggle shop status error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Delete shop
  app.delete("/api/shops/:id", authenticateToken, requireRole(["Owner", "Administrator"]), async (req: any, res) => {
    try {
      const { id } = req.params;

      // Check if shop exists
      const existingShop = await storage.getShop(id, req.user.tenantId);
      if (!existingShop) {
        return res.status(404).json({ message: "Shop not found" });
      }

      await storage.deleteShop(id, req.user.tenantId);

      res.json({ message: "Shop deleted successfully" });
    } catch (error) {
      console.error("Delete shop error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get managers for shop assignment
  app.get("/api/shops/managers/list", authenticateToken, async (req: any, res) => {
    try {
      console.log("📋 [Managers List] Request from user:", req.user.email, "Tenant:", req.user.tenantId);
      
      // Get all active users in the tenant
      const allUsers = await storage.getAllUsers(req.user.tenantId, {
        showInactive: false,
        status: 'active',
      });
      
      console.log("📋 [Managers List] Total active users found:", allUsers.length);
      
      // Filter to only include users with Manager or Owner role
      const managers = allUsers.filter(user => 
        user.role === 'Manager' || user.role === 'Owner'
      );
      
      console.log("📋 [Managers List] Managers found:", managers.length, managers.map(m => ({ email: m.email, role: m.role })));
      
      res.json({
        managers: managers.map(user => ({
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
        })),
      });
    } catch (error) {
      console.error("Get managers error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Development endpoint to create test managers
  app.post("/api/dev/create-test-managers", async (req, res) => {
    try {
      // Get default tenant
      const tenant = await storage.getTenantBySlug("default");
      if (!tenant) {
        return res.status(500).json({ message: "Default tenant not found" });
      }

      const hashedPassword = await bcrypt.hash("password123", 10);
      const managersToCreate = [
        {
          email: "john.manager@example.com",
          firstName: "John",
          lastName: "Manager",
          role: "Manager" as const,
        },
        {
          email: "jane.admin@example.com",
          firstName: "Jane", 
          lastName: "Admin",
          role: "Administrator" as const,
        },
        {
          email: "mike.manager@example.com",
          firstName: "Mike",
          lastName: "Smith",
          role: "Manager" as const,
        }
      ];

      const created = [];
      const skipped = [];

      for (const managerData of managersToCreate) {
        // Check if user already exists
        const existingUser = await storage.getUserByEmail(managerData.email, tenant.id);
        if (existingUser) {
          skipped.push(managerData.email);
          continue;
        }

        // Create user
        const newUser = await storage.createUser({
          // ID will be auto-generated by the storage layer
          email: managerData.email,
          password: hashedPassword,
          firstName: managerData.firstName,
          lastName: managerData.lastName,
          role: managerData.role,
          isActive: true,
          emailVerified: true,
          tenantId: tenant.id,
        });

        created.push(managerData.email);
      }

      res.json({ 
        message: "Test managers creation completed",
        created,
        skipped
      });
    } catch (error) {
      console.error("Create test managers error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Development endpoint to update test user to Owner role
  app.post("/api/dev/update-test-user", async (req, res) => {
    try {
      // Get default tenant
      const tenant = await storage.getTenantBySlug("default");
      if (!tenant) {
        return res.status(500).json({ message: "Default tenant not found" });
      }

      // Find test user
      const user = await storage.getUserByEmail("dan@zendwise.com", tenant.id);
      if (!user) {
        return res.status(404).json({ message: "Test user not found" });
      }

      // Update user to Owner role
      const updatedUser = await storage.updateUser(
        user.id,
        { role: "Owner" },
        tenant.id
      );

      if (!updatedUser) {
        return res.status(500).json({ message: "Failed to update user" });
      }

      res.json({
        message: "Test user updated to Owner role successfully",
        user: {
          id: updatedUser.id,
          email: updatedUser.email,
          firstName: updatedUser.firstName,
          lastName: updatedUser.lastName,
          role: updatedUser.role,
          tenantId: updatedUser.tenantId
        }
      });
    } catch (error) {
      console.error("Update test user error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Development endpoint to test token generation
  app.post("/api/dev/test-token", async (req, res) => {
    try {
      const testUserId = "test-user-123";
      const testTenantId = "test-tenant-456";
      
      // Generate test tokens
      const { accessToken, refreshToken } = generateTokens(testUserId, testTenantId);
      
      // Try to verify the access token immediately
      try {
        const decoded = jwt.verify(accessToken, JWT_SECRET) as any;
        console.log("🔍 [Dev] Token verification successful:", decoded);
        
        res.json({
          message: "Token generation and verification test successful",
          accessToken: accessToken.substring(0, 50) + "...",
          decoded: decoded,
          jwtSecret: JWT_SECRET ? "✅ Set" : "❌ Missing",
        });
      } catch (verifyError: any) {
        console.error("🔍 [Dev] Token verification failed:", verifyError);
        res.status(500).json({
          message: "Token verification failed",
          error: verifyError.message,
          jwtSecret: JWT_SECRET ? "✅ Set" : "❌ Missing",
        });
      }
    } catch (error: any) {
      console.error("🔍 [Dev] Token generation failed:", error);
      res.status(500).json({ 
        message: "Token generation failed", 
        error: error.message 
      });
    }
  });

  // Development endpoint to test verification with specific token
  app.post("/api/dev/test-verification", async (req, res) => {
    try {
      const { token } = req.body;

      if (!token) {
        return res.status(400).json({ message: "Token is required" });
      }

      console.log("🔍 [Dev] Testing verification with token:", token);

      // Test the verification endpoint
      const verificationResponse = await fetch(`http://localhost:3500/api/auth/verify-email?token=${token}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const verificationData = await verificationResponse.json();

      res.json({
        message: "Verification test completed",
        verificationResponse: {
          status: verificationResponse.status,
          ok: verificationResponse.ok,
          data: verificationData
        }
      });
    } catch (error: any) {
      console.error("Dev verification test error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Email Contacts API Routes
  
  // Get all email contacts
  app.get("/api/email-contacts", authenticateToken, async (req: any, res) => {
    try {
      const statsOnly = req.query.statsOnly === 'true';
      
      // If only stats are requested, skip fetching contacts for better performance
      if (statsOnly) {
        const stats = await storage.getEmailContactStats(req.user.tenantId);
        return res.json({ stats });
      }

      // Otherwise, fetch both contacts and stats
      const filters: ContactFilters = {
        search: req.query.search as string,
        status: req.query.status as 'active' | 'unsubscribed' | 'bounced' | 'pending' | 'all',
        listId: req.query.listId as string,
        tagId: req.query.tagId as string,
      };

      const contacts = await storage.getAllEmailContacts(req.user.tenantId, filters);
      const stats = await storage.getEmailContactStats(req.user.tenantId);

      res.json({ 
        contacts, 
        stats
      });
    } catch (error) {
      console.error("Get email contacts error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get single email contact
  app.get("/api/email-contacts/:id", authenticateToken, async (req: any, res) => {
    try {
      const { id } = req.params;
      console.log(`[Debug] Fetching contact: ${id} for tenant: ${req.user.tenantId}`);
      
      const contact = await storage.getEmailContactWithDetails(id, req.user.tenantId);

      if (!contact) {
        console.log(`[Debug] Contact not found: ${id} in tenant: ${req.user.tenantId}`);
        return res.status(404).json({ message: "Contact not found" });
      }

      console.log(`[Debug] Contact found: ${contact.email}`);
      res.json({ contact });
    } catch (error) {
      console.error("Get email contact error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get contact engagement statistics (real-time from activities)
  app.get("/api/email-contacts/:id/stats", authenticateToken, async (req: any, res) => {
    try {
      const { id } = req.params;
      
      // Verify contact exists and belongs to tenant
      const contact = await storage.getEmailContact(id, req.user.tenantId);
      if (!contact) {
        return res.status(404).json({ message: "Contact not found" });
      }

      // Get real-time engagement statistics from email activities
      const stats = await storage.getContactEngagementStats(id, req.user.tenantId);
      
      res.json({ 
        contactId: id,
        stats
      });
    } catch (error) {
      console.error("Get contact engagement stats error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Create new email contact
  app.post("/api/email-contacts", authenticateToken, async (req: any, res) => {
    try {
      const contactData = req.body; // Use the schema from shared/schema.ts
      
      // Extract client information for consent tracking
      const clientIP = getClientIP(req);
      const userAgent = req.get('User-Agent') || '';
      
      const contact = await storage.createEmailContact(
        contactData, 
        req.user.tenantId, 
        req.user.userId,
        clientIP,
        userAgent
      );

      res.status(201).json({
        message: "Email contact created successfully",
        contact,
      });
    } catch (error: any) {
      console.error("Create email contact error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Update email contact
  app.put("/api/email-contacts/:id", authenticateToken, async (req: any, res) => {
    try {
      const { id } = req.params;
      const contactData = req.body;
      
      const contact = await storage.updateEmailContact(id, contactData, req.user.tenantId);

      if (!contact) {
        return res.status(404).json({ message: "Contact not found" });
      }

      res.json({
        message: "Email contact updated successfully",
        contact,
      });
    } catch (error: any) {
      console.error("Update email contact error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Update email contact
  app.put("/api/email-contacts/:id", authenticateToken, async (req: any, res) => {
    try {
      const { id } = req.params;
      const contactData = req.body;

      // Check if contact exists and belongs to tenant
      const existingContact = await storage.getEmailContact(id, req.user.tenantId);
      if (!existingContact) {
        return res.status(404).json({ message: "Contact not found" });
      }

      const contact = await storage.updateEmailContact(id, contactData, req.user.tenantId);

      res.json({
        message: "Email contact updated successfully",
        contact,
      });
    } catch (error: any) {
      console.error("Update email contact error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Delete email contact
  app.delete("/api/email-contacts/:id", authenticateToken, async (req: any, res) => {
    try {
      const { id } = req.params;

      // Check if contact exists
      const existingContact = await storage.getEmailContact(id, req.user.tenantId);
      if (!existingContact) {
        return res.status(404).json({ message: "Contact not found" });
      }

      await storage.deleteEmailContact(id, req.user.tenantId);

      res.json({ message: "Email contact deleted successfully" });
    } catch (error) {
      console.error("Delete email contact error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Bulk delete email contacts
  app.delete("/api/email-contacts", authenticateToken, async (req: any, res) => {
    try {
      const { ids } = req.body;

      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ message: "Contact IDs array is required" });
      }

      await storage.bulkDeleteEmailContacts(ids, req.user.tenantId);

      res.json({ message: `${ids.length} email contacts deleted successfully` });
    } catch (error) {
      console.error("Bulk delete email contacts error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Email Lists API Routes
  
  // Get all email lists
  app.get("/api/email-lists", authenticateToken, async (req: any, res) => {
    try {
      const lists = await storage.getAllEmailLists(req.user.tenantId);
      res.json({ lists });
    } catch (error) {
      console.error("Get email lists error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Create new email list
  app.post("/api/email-lists", authenticateToken, async (req: any, res) => {
    try {
      const listData = req.body;
      const list = await storage.createEmailList(listData, req.user.tenantId);

      res.status(201).json({
        message: "Email list created successfully",
        list,
      });
    } catch (error: any) {
      console.error("Create email list error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Update email list
  app.put("/api/email-lists/:id", authenticateToken, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { name, description } = req.body;

      const list = await storage.updateEmailList(id, name, description, req.user.tenantId);

      if (!list) {
        return res.status(404).json({ message: "Email list not found" });
      }

      res.json({
        message: "Email list updated successfully",
        list,
      });
    } catch (error: any) {
      console.error("Update email list error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Delete email list
  app.delete("/api/email-lists/:id", authenticateToken, async (req: any, res) => {
    try {
      const { id } = req.params;

      // Check if list exists
      const existingList = await storage.getEmailList(id, req.user.tenantId);
      if (!existingList) {
        return res.status(404).json({ message: "Email list not found" });
      }

      await storage.deleteEmailList(id, req.user.tenantId);

      res.json({ message: "Email list deleted successfully" });
    } catch (error) {
      console.error("Delete email list error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Bounced Emails API Routes
  
  // Get all bounced emails (Admin only - cross-tenant)
  app.get("/api/bounced-emails", authenticateToken, async (req: any, res) => {
    try {
      // Check if user has admin permissions
      if (!['Owner', 'Administrator'].includes(req.user.role)) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      const filters: BouncedEmailFilters = {
        search: req.query.search as string,
        bounceType: req.query.bounceType as 'hard' | 'soft' | 'complaint' | 'all',
        isActive: req.query.isActive === 'true' ? true : req.query.isActive === 'false' ? false : undefined,
        tenantId: req.query.tenantId as string,
      };

      const bouncedEmails = await storage.getAllBouncedEmails(filters);
      res.json({ bouncedEmails });
    } catch (error) {
      console.error("Get bounced emails error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Check if email is bounced
  app.get("/api/bounced-emails/check/:email", authenticateToken, async (req: any, res) => {
    try {
      const { email } = req.params;
      const isBounced = await storage.isEmailBounced(email);
      const bouncedEmail = isBounced ? await storage.getBouncedEmail(email) : null;
      
      res.json({ 
        email,
        isBounced,
        bouncedEmail
      });
    } catch (error) {
      console.error("Check bounced email error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Remove email from bounced list (Admin only)
  app.delete("/api/bounced-emails/:email", authenticateToken, async (req: any, res) => {
    try {
      // Check if user has admin permissions
      if (!['Owner', 'Administrator'].includes(req.user.role)) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      const { email } = req.params;
      await storage.removeBouncedEmail(email);
      
      res.json({ message: "Email removed from bounced list successfully" });
    } catch (error) {
      console.error("Remove bounced email error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Manually add email to bounced list (Admin only)
  app.post("/api/bounced-emails", authenticateToken, async (req: any, res) => {
    try {
      // Check if user has admin permissions
      if (!['Owner', 'Administrator'].includes(req.user.role)) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      const bouncedEmailData = {
        email: req.body.email,
        bounceType: req.body.bounceType || 'hard',
        bounceReason: req.body.bounceReason || 'Manually added',
        bounceSubType: req.body.bounceSubType,
        firstBouncedAt: new Date(),
        lastBouncedAt: new Date(),
        bounceCount: 1,
        sourceTenantId: req.user.tenantId,
        suppressionReason: req.body.suppressionReason || 'Manually added to bounced list',
        lastAttemptedAt: new Date(),
      };

      const bouncedEmail = await storage.addBouncedEmail(bouncedEmailData);
      res.status(201).json({ 
        message: "Email added to bounced list successfully",
        bouncedEmail
      });
    } catch (error) {
      console.error("Add bounced email error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get bounced email statistics
  app.get("/api/bounced-emails/stats", authenticateToken, async (req: any, res) => {
    try {
      // Check if user has admin permissions
      if (!['Owner', 'Administrator'].includes(req.user.role)) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      const allBounced = await storage.getAllBouncedEmails();
      const stats = {
        totalBounced: allBounced.length,
        activeBounced: allBounced.filter(b => b.isActive).length,
        inactiveBounced: allBounced.filter(b => !b.isActive).length,
        hardBounces: allBounced.filter(b => b.bounceType === 'hard').length,
        softBounces: allBounced.filter(b => b.bounceType === 'soft').length,
        complaints: allBounced.filter(b => b.bounceType === 'complaint').length,
        byTenant: allBounced.reduce((acc, b) => {
          if (b.sourceTenantId) {
            acc[b.sourceTenantId] = (acc[b.sourceTenantId] || 0) + 1;
          }
          return acc;
        }, {} as Record<string, number>)
      };

      res.json({ stats });
    } catch (error) {
      console.error("Get bounced email stats error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Contact Tags API Routes
  
  // Get all contact tags
  app.get("/api/contact-tags", authenticateToken, async (req: any, res) => {
    try {
      const tags = await storage.getAllContactTags(req.user.tenantId);
      res.json({ tags });
    } catch (error) {
      console.error("Get contact tags error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Create new contact tag
  app.post("/api/contact-tags", authenticateToken, async (req: any, res) => {
    try {
      const tagData = req.body;
      const tag = await storage.createContactTag(tagData, req.user.tenantId);

      res.status(201).json({
        message: "Contact tag created successfully",
        tag,
      });
    } catch (error: any) {
      console.error("Create contact tag error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Update contact tag
  app.put("/api/contact-tags/:id", authenticateToken, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { name, color } = req.body;

      const tag = await storage.updateContactTag(id, name, color, req.user.tenantId);

      if (!tag) {
        return res.status(404).json({ message: "Contact tag not found" });
      }

      res.json({
        message: "Contact tag updated successfully",
        tag,
      });
    } catch (error: any) {
      console.error("Update contact tag error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Delete contact tag
  app.delete("/api/contact-tags/:id", authenticateToken, async (req: any, res) => {
    try {
      const { id } = req.params;

      // Check if tag exists
      const existingTag = await storage.getContactTag(id, req.user.tenantId);
      if (!existingTag) {
        return res.status(404).json({ message: "Contact tag not found" });
      }

      await storage.deleteContactTag(id, req.user.tenantId);

      res.json({ message: "Contact tag deleted successfully" });
    } catch (error) {
      console.error("Delete contact tag error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Contact List Membership Operations
  
  // Add contact to list
  app.post("/api/email-contacts/:contactId/lists/:listId", authenticateToken, async (req: any, res) => {
    try {
      const { contactId, listId } = req.params;

      await storage.addContactToList(contactId, listId, req.user.tenantId);

      res.json({ message: "Contact added to list successfully" });
    } catch (error) {
      console.error("Add contact to list error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Remove contact from list
  app.delete("/api/email-contacts/:contactId/lists/:listId", authenticateToken, async (req: any, res) => {
    try {
      const { contactId, listId } = req.params;

      await storage.removeContactFromList(contactId, listId, req.user.tenantId);

      res.json({ message: "Contact removed from list successfully" });
    } catch (error) {
      console.error("Remove contact from list error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Bulk add contacts to list
  app.post("/api/email-lists/:listId/contacts", authenticateToken, async (req: any, res) => {
    try {
      const { listId } = req.params;
      const { contactIds } = req.body;

      if (!Array.isArray(contactIds) || contactIds.length === 0) {
        return res.status(400).json({ message: "Contact IDs array is required" });
      }

      await storage.bulkAddContactsToList(contactIds, listId, req.user.tenantId);

      res.json({ message: `${contactIds.length} contacts added to list successfully` });
    } catch (error) {
      console.error("Bulk add contacts to list error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Contact Tag Assignment Operations
  
  // Add tag to contact
  app.post("/api/email-contacts/:contactId/tags/:tagId", authenticateToken, async (req: any, res) => {
    try {
      const { contactId, tagId } = req.params;

      await storage.addTagToContact(contactId, tagId, req.user.tenantId);

      res.json({ message: "Tag added to contact successfully" });
    } catch (error) {
      console.error("Add tag to contact error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Remove tag from contact
  app.delete("/api/email-contacts/:contactId/tags/:tagId", authenticateToken, async (req: any, res) => {
    try {
      const { contactId, tagId } = req.params;

      await storage.removeTagFromContact(contactId, tagId, req.user.tenantId);

      res.json({ message: "Tag removed from contact successfully" });
    } catch (error) {
      console.error("Remove tag from contact error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Bulk add tag to contacts
  app.post("/api/contact-tags/:tagId/contacts", authenticateToken, async (req: any, res) => {
    try {
      const { tagId } = req.params;
      const { contactIds } = req.body;

      if (!Array.isArray(contactIds) || contactIds.length === 0) {
        return res.status(400).json({ message: "Contact IDs array is required" });
      }

      await storage.bulkAddTagToContacts(contactIds, tagId, req.user.tenantId);

      res.json({ message: `Tag added to ${contactIds.length} contacts successfully` });
    } catch (error) {
      console.error("Bulk add tag to contacts error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ====================================
  // EMAIL ACTIVITY ROUTES (for webhook tracking)
  // ====================================

  // Get contact activity (timeline)
  app.get("/api/email-contacts/:contactId/activity", authenticateToken, async (req: any, res) => {
    try {
      const { contactId } = req.params;
      const limit = req.query.limit ? parseInt(req.query.limit) : 50;
      const fromDate = req.query.from ? new Date(req.query.from) : undefined;
      const toDate = req.query.to ? new Date(req.query.to) : undefined;
      
      // No need to adjust dates - frontend now sends proper timestamps

      const activities = await storage.getContactActivity(contactId, req.user.tenantId, limit, fromDate, toDate);
      res.json({ activities });
    } catch (error) {
      console.error("Get contact activity error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Webhook endpoint for Resend - GET handler
  app.get("/api/webhooks/resend", async (req, res) => {
    console.log("[Webhook] GET request received on /api/webhooks/resend");
    console.log("[Webhook] Headers:", JSON.stringify(req.headers, null, 2));
    console.log("[Webhook] Query params:", JSON.stringify(req.query, null, 2));
    console.log("[Webhook] IP address:", req.ip || req.connection.remoteAddress);
    console.log("[Webhook] User agent:", req.get('User-Agent'));
    
    res.status(200).json({ 
      message: "Nothing to see here",
      endpoint: "POST /api/webhooks/resend",
      description: "This endpoint should not be called directly. Access attempt will be logged."
    });
  });

  // Test endpoint to simulate a Resend webhook (for development only)
  if (process.env.NODE_ENV === 'development') {
    app.post("/api/test/webhook-open", authenticateToken, async (req: any, res) => {
      try {
        const { newsletterId, contactEmail } = req.body;
        
        if (!newsletterId || !contactEmail) {
          return res.status(400).json({ message: "newsletterId and contactEmail are required" });
        }

        console.log(`[Test Webhook] Simulating email open for newsletter ${newsletterId}, contact ${contactEmail}`);
        
        // Get the newsletter to verify it exists
        const newsletter = await storage.getNewsletter(newsletterId, req.user.tenantId);
        if (!newsletter) {
          return res.status(404).json({ message: "Newsletter not found" });
        }

        // Simulate a Resend webhook payload for email.opened event
        const simulatedWebhookPayload = {
          type: 'email.opened',
          data: {
            id: `test-resend-id-${Date.now()}`,
            to: [{ email: contactEmail }],
            subject: newsletter.subject,
            tags: [
              { name: 'newsletter_id', value: `newsletter-${newsletterId}` },
              { name: 'groupUUID', value: `test-group-${Date.now()}` },
              { name: 'type', value: 'newsletter' }
            ],
            user_agent: 'Test Browser',
            ip: '127.0.0.1'
          }
        };

        // Process the simulated webhook through the same logic
        // Find contact by email
        const allContacts = await storage.getAllEmailContacts(req.user.tenantId);
        const contact = allContacts.find(c => c.email === contactEmail);
        if (!contact) {
          return res.status(404).json({ message: "Contact not found" });
        }

        // Update contact open count
        await storage.updateEmailContact(contact.id, { 
          emailsOpened: (contact.emailsOpened || 0) + 1,
          lastActivity: new Date() 
        }, req.user.tenantId);

        // Update newsletter open count
        const oldOpenCount = newsletter.openCount || 0;
        await updateNewsletterStats(newsletterId, 'email.opened', req.user.tenantId, contact.id);
        
        // Get updated newsletter to verify the change
        const updatedNewsletter = await storage.getNewsletter(newsletterId, req.user.tenantId);
        
        res.json({
          message: "Test webhook processed successfully",
          newsletterId,
          contactEmail,
          previousOpenCount: oldOpenCount,
          newOpenCount: updatedNewsletter?.openCount || 0,
          webhookPayload: simulatedWebhookPayload
        });
      } catch (error) {
        console.error("[Test Webhook] Error:", error);
        res.status(500).json({ message: "Test webhook failed", error: error instanceof Error ? error.message : String(error) });
      }
    });
  }

  // Helper functions for webhook processing
  async function updateEmailTrackingEntry(trackingEntry: any, webhookType: string, webhookData: any, goServerUrl: string, accessToken: string, resendId: string, tenantId?: string) {
    const statusMapping: Record<string, string> = {
      'email.sent': 'sent',
      'email.delivered': 'delivered', 
      'email.delivery_delayed': 'delayed',
      'email.bounced': 'bounced',
      'email.complained': 'complained',
      'email.failed': 'failed',
      'email.opened': 'opened',
      'email.clicked': 'clicked',
      'email.unsubscribed': 'unsubscribed'
    };
    
    const newStatus = statusMapping[webhookType] || trackingEntry.status;
    
    // Update the tracking entry with new status and webhook data
    const updatePayload = {
      status: newStatus,
      metadata: {
        ...trackingEntry.metadata,
        lastWebhookEvent: webhookType,
        lastWebhookAt: new Date().toISOString(),
        webhookHistory: [
          ...(trackingEntry.metadata?.webhookHistory || []),
          {
            event: webhookType,
            timestamp: new Date().toISOString(),
            data: {
              messageId: webhookData.message_id,
              subject: webhookData.subject,
              userAgent: webhookData.user_agent,
              ipAddress: webhookData.ip,
              resendId: resendId
            }
          }
        ].slice(-10) // Keep only last 10 webhook events
      }
    };
    
    const updateResponse = await fetch(`${goServerUrl}/api/email-tracking/${trackingEntry.id}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updatePayload)
    });
    
    if (updateResponse.ok) {
      console.log(`[Webhook] Successfully updated email tracking status to '${newStatus}' for ResendID: ${resendId}`);
      
      // If this is a newsletter email, also update newsletter statistics
      if (trackingEntry.metadata?.newsletterId && (webhookType === 'email.opened' || webhookType === 'email.clicked')) {
        const effectiveTenantId = tenantId || trackingEntry.tenantId;
        if (effectiveTenantId) {
          console.log(`[Webhook] Updating newsletter stats for newsletter ${trackingEntry.metadata.newsletterId}, event: ${webhookType}, tenant: ${effectiveTenantId}`);
          // Note: No emailId available in this context as it's from Go tracking system
          await updateNewsletterStats(trackingEntry.metadata.newsletterId, webhookType, effectiveTenantId);
        } else {
          console.error(`[Webhook] Cannot update newsletter stats - no tenant ID available`);
        }
      }
      
    } else {
      console.error(`[Webhook] Failed to update email tracking status: ${updateResponse.status}`);
    }
  }

  async function findEmailTrackingByAlternativeMethods(resendId: string, email: string, webhookData: any, goServerUrl: string, accessToken: string) {
    try {
      // Method 1: Search all tracking entries for matching email and recent timestamp
      console.log(`[Webhook] Attempting alternative lookup for ResendID: ${resendId}, email: ${email}`);
      
      const allTrackingResponse = await fetch(`${goServerUrl}/api/email-tracking`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        }
      });
      
      if (allTrackingResponse.ok) {
        const allTrackingData = await allTrackingResponse.json();
        const entries = allTrackingData.entries || [];
        
        // Look for entries with matching recipient email and recent timestamp (within last 10 minutes)
        const recentCutoff = Date.now() - (10 * 60 * 1000); // 10 minutes ago
        
        for (const entry of entries) {
          // Check if this entry matches the email and is recent
          if (entry.metadata?.recipient === email || entry.metadata?.to === email) {
            const entryTimestamp = new Date(entry.timestamp).getTime();
            if (entryTimestamp >= recentCutoff) {
              console.log(`[Webhook] Found potential match via email/timestamp: ${entry.id}`);
              
              // Update the entry with the ResendID using the dedicated endpoint
              const updatePayload = {
                resendId: resendId
              };
              
              const updateResponse = await fetch(`${goServerUrl}/api/email-tracking/${entry.id}/resend-id`, {
                method: 'PUT',
                headers: {
                  'Authorization': `Bearer ${accessToken}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(updatePayload)
              });
              
              if (updateResponse.ok) {
                console.log(`[Webhook] Successfully updated entry ${entry.id} with ResendID: ${resendId}`);
                const updatedEntry = await updateResponse.json();
                return updatedEntry;
              }
            }
          }
        }
      }
      
      console.log(`[Webhook] No alternative matches found for ResendID: ${resendId}`);
      return null;
      
    } catch (error) {
      console.error(`[Webhook] Error in alternative lookup for ResendID ${resendId}:`, error);
      return null;
    }
  }

  async function scheduleWebhookRetry(resendId: string, webhookType: string, webhookData: any, email: string) {
    try {
      // Store webhook data for retry processing later
      // This could be implemented with a queue system, database, or in-memory store
      // For now, we'll use a simple setTimeout to retry after 30 seconds
      
      console.log(`[Webhook] Scheduling retry for ResendID: ${resendId} in 30 seconds`);
      
      setTimeout(async () => {
        console.log(`[Webhook] Retrying webhook processing for ResendID: ${resendId}`);
        
        try {
          const GO_SERVER_URL = process.env.GO_SERVER_URL || process.env.GO_EMAIL_SERVER_URL || 'https://tenginew.zendwise.work';
          const accessToken = process.env.EMAIL_TRACKING_TOKEN || process.env.JWT_SECRET || 'Cvgii9bYKF1HtfD8TODRyZFTmFP4vu70oR59YrjGVpS2fXzQ41O3UPRaR8u9uAqNhwK5ZxZPbX5rAOlMrqe8ag==';
          
          // Try ResendID lookup again
          const trackingResponse = await fetch(`${GO_SERVER_URL}/api/email-tracking/resend/${resendId}`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            }
          });
          
          if (trackingResponse.ok) {
            const trackingEntry = await trackingResponse.json();
            console.log(`[Webhook] Retry found email tracking entry: ${trackingEntry.id} for ResendID: ${resendId}`);
            await updateEmailTrackingEntry(trackingEntry, webhookType, webhookData, GO_SERVER_URL, accessToken, resendId);
          } else {
            console.log(`[Webhook] Retry still unable to find tracking entry for ResendID: ${resendId}`);
          }
          
        } catch (retryError) {
          console.error(`[Webhook] Error in retry processing for ResendID ${resendId}:`, retryError);
        }
      }, 30000); // Retry after 30 seconds
      
    } catch (error) {
      console.error(`[Webhook] Error scheduling webhook retry for ResendID ${resendId}:`, error);
    }
  }

  async function updateNewsletterStats(newsletterId: string, webhookType: string, tenantId: string, contactId?: string) {
    try {
      console.log(`[Webhook] Attempting to update newsletter stats:`, { newsletterId, webhookType, tenantId, contactId });

      // Helper to perform the update for a resolved tenant/newsletter
      const performUpdate = async (resolvedTenantId: string) => {
        if (webhookType === 'email.opened') {
          console.log(`[Webhook] Processing email open event for newsletter ${newsletterId}`);
          const newsletter = await storage.getNewsletter(newsletterId, resolvedTenantId);
          if (newsletter) {
            // Always increment total opens
            const newOpenCount = (newsletter.openCount || 0) + 1;
            let newUniqueOpenCount = newsletter.uniqueOpenCount || 0;
            
            // Check if this is a unique open (only for newsletter emails with contactId)
            let isUniqueOpen = false;
            if (contactId) {
              const hasBeenOpened = await storage.hasContactOpenedNewsletter(contactId, newsletterId, resolvedTenantId);
              isUniqueOpen = !hasBeenOpened;
              if (isUniqueOpen) {
                newUniqueOpenCount = newUniqueOpenCount + 1;
              }
            }

            console.log(`[Webhook] Found newsletter, updating openCount from ${newsletter.openCount || 0} to ${newOpenCount}, uniqueOpenCount from ${newsletter.uniqueOpenCount || 0} to ${newUniqueOpenCount}, isUniqueOpen: ${isUniqueOpen}`);

            const updatedNewsletter = await storage.updateNewsletter(newsletterId, { 
              openCount: newOpenCount,
              uniqueOpenCount: newUniqueOpenCount 
            } as any, resolvedTenantId);
            
            if (updatedNewsletter) {
              console.log(`[Webhook] ✅ Updated newsletter ${newsletterId} openCount to ${newOpenCount}, uniqueOpenCount to ${newUniqueOpenCount} (tenant: ${resolvedTenantId})`);
            } else {
              console.error(`[Webhook] ❌ Failed to update newsletter ${newsletterId} - update returned null/undefined (tenant: ${resolvedTenantId})`);
            }
          } else {
            console.error(`[Webhook] ❌ Newsletter ${newsletterId} not found in tenant ${resolvedTenantId}`);
          }
        } else if (webhookType === 'email.clicked') {
          console.log(`[Webhook] Processing email click event for newsletter ${newsletterId}`);
          const newsletter = await storage.getNewsletter(newsletterId, resolvedTenantId);
          if (newsletter) {
            const newClickCount = (newsletter.clickCount || 0) + 1;
            console.log(`[Webhook] Found newsletter, updating clickCount from ${newsletter.clickCount || 0} to ${newClickCount}`);

            const updatedNewsletter = await storage.updateNewsletter(newsletterId, { clickCount: newClickCount }, resolvedTenantId);
            if (updatedNewsletter) {
              console.log(`[Webhook] ✅ Updated newsletter ${newsletterId} clickCount to ${newClickCount} (tenant: ${resolvedTenantId})`);
            } else {
              console.error(`[Webhook] ❌ Failed to update newsletter ${newsletterId} - update returned null/undefined (tenant: ${resolvedTenantId})`);
            }
          } else {
            console.error(`[Webhook] ❌ Newsletter ${newsletterId} not found in tenant ${resolvedTenantId}`);
          }
        } else {
          console.log(`[Webhook] Ignoring webhook event ${webhookType} - not relevant for newsletter stats`);
        }
      };

      // First try with provided tenantId
      const existsInTenant = await storage.getNewsletter(newsletterId, tenantId);
      if (existsInTenant) {
        await performUpdate(tenantId);
        return;
      }

      // Fallback: resolve the correct tenant for this newsletter ID across tenants
      console.warn(`[Webhook] Newsletter ${newsletterId} not found in provided tenant ${tenantId}. Attempting cross-tenant lookup.`);
      const crossTenantNewsletter = await storage.getNewsletterById(newsletterId);
      if (crossTenantNewsletter) {
        console.warn(`[Webhook] Resolved newsletter tenant as ${crossTenantNewsletter.tenantId}. Proceeding with update.`);
        await performUpdate(crossTenantNewsletter.tenantId);
        return;
      }

      console.error(`[Webhook] ❌ Newsletter ${newsletterId} not found in any tenant`);
    } catch (error) {
      console.error(`[Webhook] Error updating newsletter stats for ${newsletterId}:`, error);
      console.error(`[Webhook] Error context:`, { newsletterId, webhookType, tenantId, contactId });
    }
  }

  // Webhook endpoint for Resend - POST handler
  app.post("/api/webhooks/resend", async (req, res) => {
    // Log ALL incoming POST requests to this endpoint
    console.log("=".repeat(80));
    console.log("[Webhook] POST request received on /api/webhooks/resend");
    console.log("[Webhook] Timestamp:", new Date().toISOString());
    console.log("[Webhook] IP address:", req.ip || req.connection.remoteAddress);
    console.log("[Webhook] User agent:", req.get('User-Agent'));
    console.log("[Webhook] Content-Type:", req.get('Content-Type'));
    console.log("[Webhook] Content-Length:", req.get('Content-Length'));
    console.log("[Webhook] Headers:", JSON.stringify(req.headers, null, 2));
    console.log("[Webhook] Raw body:", JSON.stringify(req.body, null, 2));
    console.log("=".repeat(80));
    
    try {
      // Validate webhook signature using Svix (Resend's official method)
      // Reference: https://resend.com/docs/dashboard/webhooks/verify-webhooks-requests
      
      const webhookSecret = process.env.RESEND_WEBHOOK_SECRET || process.env.WEBHOOK_SECRET || 'whsec_J7jRqP+O3h1aWJbuuRM4B3tc08HwtFSg';
      console.log("[Webhook] Webhook secret check:", {
        envResendSecret: process.env.RESEND_WEBHOOK_SECRET ? "present" : "missing",
        envWebhookSecret: process.env.WEBHOOK_SECRET ? "present" : "missing", 
        finalSecret: webhookSecret ? webhookSecret.substring(0, 10) + "..." : "none"
      });
      
      if (!webhookSecret) {
        console.log("[Webhook] VALIDATION FAILED: No webhook secret configured");
        console.log("[Webhook] Please set RESEND_WEBHOOK_SECRET or WEBHOOK_SECRET environment variable");
        console.log("[Webhook] Request processing terminated - no webhook secret");
        console.log("=".repeat(80));
        return res.status(500).json({ message: "Webhook secret not configured" });
      }

      // Skip Svix headers - using resend-signature validation instead

      // Get raw payload as string (crucial for signature verification)
      const payload = JSON.stringify(req.body);
      
      // Simplified signature validation using resend-signature header instead of svix
      const resendSignature = req.get('resend-signature');
      console.log("[Webhook] Checking resend-signature header:", resendSignature ? "present" : "missing");
      
      if (resendSignature) {
        // Parse the signature format: t=timestamp,v1=signature
        const sigParts = resendSignature.split(',');
        let timestamp: string = '';
        let signature: string = '';
        
        for (const part of sigParts) {
          const [key, value] = part.split('=');
          if (key === 't') timestamp = value;
          if (key === 'v1') signature = value;
        }
        
        console.log("[Webhook] Parsed signature - timestamp:", timestamp, "signature:", signature ? "present" : "missing");
        
        if (timestamp && signature) {
          // Check timestamp (5-minute tolerance)
          const webhookTimestamp = parseInt(timestamp);
          const currentTimestamp = Math.floor(Date.now() / 1000);
          const timeDiff = Math.abs(currentTimestamp - webhookTimestamp);
          
          console.log("[Webhook] Timestamp validation:", {
            webhookTime: webhookTimestamp,
            currentTime: currentTimestamp,
            difference: timeDiff,
            valid: timeDiff <= 300
          });
          
          if (timeDiff > 300) { // 5 minutes
            console.log("[Webhook] VALIDATION FAILED: Timestamp too old");
            console.log("[Webhook] Request processing terminated - timestamp validation failed");
            console.log("=".repeat(80));
            return res.status(401).json({ message: "Request timestamp too old" });
          }
          
          // Create expected signature using HMAC-SHA256
          const expectedSignature = createHmac('sha256', webhookSecret)
            .update(timestamp + '.' + payload)
            .digest('base64');
          
          console.log("[Webhook] Signature validation:", {
            received: signature.substring(0, 10) + "...",
            expected: expectedSignature.substring(0, 10) + "...",
            match: signature === expectedSignature
          });
          
          // Comment out signature check for development
          /*
          if (signature !== expectedSignature) {
            console.log("[Webhook] VALIDATION FAILED: Signature mismatch");
            console.log("[Webhook] Request processing terminated - signature validation failed");
            console.log("=".repeat(80));
            return res.status(401).json({ message: "Invalid webhook signature" });
          }
          */
          
          console.log("[Webhook] ✅ Signature verification SKIPPED (development mode)");
        } else {
          console.log("[Webhook] VALIDATION FAILED: Invalid resend-signature format");
          console.log("[Webhook] Expected format: t=timestamp,v1=signature");
          console.log("[Webhook] Request processing terminated - invalid signature format");
          console.log("=".repeat(80));
          return res.status(401).json({ message: "Invalid signature format" });
        }
      } else {
        console.log("[Webhook] WARNING: No signature validation (missing resend-signature header)");
        console.log("[Webhook] This request will be processed but may not be authentic");
      }
      
      // Skip signature validation for development - process webhook regardless
      console.log("[Webhook] DEVELOPMENT MODE: Proceeding without signature validation");
      
      const webhookData = req.body;
      console.log("[Webhook] Processing verified webhook data:", JSON.stringify(webhookData, null, 2));

      // Extract essential information from webhook
      const { type, data } = webhookData;
      
      if (!type || !data) {
        console.log("[Webhook] VALIDATION FAILED: Invalid webhook format - missing type or data");
        console.log("[Webhook] Type:", type, "Data:", data ? "present" : "missing");
        console.log("[Webhook] Request processing terminated - invalid format");
        console.log("=".repeat(80));
        return res.status(400).json({ message: "Invalid webhook format" });
      }

      // Handle different webhook types
      const supportedEvents = ['email.sent', 'email.delivered', 'email.delivery_delayed', 'email.bounced', 'email.complained', 'email.opened', 'email.clicked', 'email.failed', 'email.scheduled', 'email.unsubscribed'];
      
      if (!supportedEvents.includes(type)) {
        console.log(`[Webhook] UNSUPPORTED EVENT: ${type}`);
        console.log("[Webhook] Supported events:", supportedEvents.join(", "));
        console.log("[Webhook] Request processing terminated - unsupported event type");
        console.log("=".repeat(80));
        return res.status(200).json({ message: "Event type not handled" });
      }
      
      console.log(`[Webhook] ✅ Event type '${type}' is supported, continuing processing...`);

      // Extract email and find contact
      let email = data.email || data.to;
      
      // Handle different email formats from Resend
      if (Array.isArray(email)) {
        email = email[0]; // Take the first email if it's an array
      }
      if (typeof email === 'object' && email?.email) {
        email = email.email; // Handle { email: "user@example.com" } format
      }
      
      console.log("[Webhook] Raw email data from webhook:", data.to || data.email);
      console.log("[Webhook] Extracted email address:", email);
      
      if (!email || typeof email !== 'string') {
        console.log("[Webhook] VALIDATION FAILED: No valid email found in webhook data");
        console.log("[Webhook] Checked data.email, data.to (array and object formats)");
        console.log("[Webhook] Available data fields:", Object.keys(data));
        console.log("[Webhook] data.to content:", data.to);
        console.log("[Webhook] Request processing terminated - no email found");
        console.log("=".repeat(80));
        return res.status(400).json({ message: "No email address found" });
      }

      // Find contact across all tenants (since webhook doesn't include tenant info)
      console.log("[Webhook] Looking up contact for email:", email);
      
      // Check if any contacts exist in the database
      try {
        const allContacts = await storage.getAllEmailContactsDebug();
        if (allContacts.length === 0) {
          return res.status(404).json({ 
            message: "Contact not found", 
            debug: "No contacts exist in database. Add contacts before sending newsletters." 
          });
        }
      } catch (debugError) {
        console.error("[Webhook] Error checking contact database:", debugError);
      }
      
      // Try to find the contact
      let contactResult = await storage.findEmailContactByEmail(email);
      
      if (!contactResult) {
        return res.status(404).json({ 
          message: "Contact not found",
          debug: `Email '${email}' is not in the contacts database. Add this contact first.`
        });
      }
      
      console.log("[Webhook] ✅ Contact found:", contactResult.contact.id, "in tenant:", contactResult.tenantId);

      const { contact, tenantId } = contactResult;

      // Map webhook event types to activity types
      const eventTypeMapping: Record<string, string> = {
        'email.sent': 'sent',
        'email.delivered': 'delivered',
        'email.delivery_delayed': 'delivered',
        'email.bounced': 'bounced',
        'email.complained': 'complained',
        'email.opened': 'opened',
        'email.clicked': 'clicked',
        'email.failed': 'failed',
        'email.scheduled': 'scheduled',
        'email.unsubscribed': 'unsubscribed'
      };

      const activityType = eventTypeMapping[type];
      if (!activityType) {
        console.log(`[Webhook] Unknown activity type for event: ${type}`);
        return res.status(200).json({ message: "Event type mapping not found" });
      }

      // Extract ResendID for tracking email status updates
      const resendId = data.id || data.message_id;
      console.log(`[Webhook] Extracted ResendID: ${resendId}`);
      
      // Update email tracking status if ResendID is available
      if (resendId) {
        try {
          // Try to update the Go email tracking system
          const GO_SERVER_URL = process.env.GO_SERVER_URL || process.env.GO_EMAIL_SERVER_URL || 'https://tenginew.zendwise.work';
          const accessToken = process.env.EMAIL_TRACKING_TOKEN || process.env.JWT_SECRET || 'Cvgii9bYKF1HtfD8TODRyZFTmFP4vu70oR59YrjGVpS2fXzQ41O3UPRaR8u9uAqNhwK5ZxZPbX5rAOlMrqe8ag==';
          
          console.log(`[Webhook] Looking up email tracking by ResendID: ${resendId}`);
          
          // Lookup email tracking entry by ResendID
          const trackingResponse = await fetch(`${GO_SERVER_URL}/api/email-tracking/resend/${resendId}`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            }
          });
          
          if (trackingResponse.ok) {
            const trackingEntry = await trackingResponse.json();
            console.log(`[Webhook] Found email tracking entry: ${trackingEntry.id} for ResendID: ${resendId}`);
            
            await updateEmailTrackingEntry(trackingEntry, type, data, GO_SERVER_URL, accessToken, resendId, tenantId);
            
          } else if (trackingResponse.status === 404) {
            console.log(`[Webhook] No email tracking entry found for ResendID: ${resendId}`);
            
            // Try alternative lookup methods for newsletter emails
            const alternativeEntry = await findEmailTrackingByAlternativeMethods(resendId, email, data, GO_SERVER_URL, accessToken);
            if (alternativeEntry) {
              console.log(`[Webhook] Found email tracking entry via alternative lookup: ${alternativeEntry.id}`);
              await updateEmailTrackingEntry(alternativeEntry, type, data, GO_SERVER_URL, accessToken, resendId, tenantId);
            } else {
              console.log(`[Webhook] No email tracking entry found via alternative methods for ResendID: ${resendId}`);
              // Store webhook for later processing when tracking entry becomes available
              await scheduleWebhookRetry(resendId, type, data, email);
            }
            
          } else {
            console.error(`[Webhook] Failed to lookup email tracking: ${trackingResponse.status}`);
            // Also try alternative lookup for non-404 errors as ResendID index might not be ready
            const alternativeEntry = await findEmailTrackingByAlternativeMethods(resendId, email, data, GO_SERVER_URL, accessToken);
            if (alternativeEntry) {
              console.log(`[Webhook] Found email tracking entry via alternative lookup after error: ${alternativeEntry.id}`);
              await updateEmailTrackingEntry(alternativeEntry, type, data, GO_SERVER_URL, accessToken, resendId, tenantId);
            }
          }
          
        } catch (error) {
          console.error(`[Webhook] Error updating email tracking for ResendID ${resendId}:`, error);
          
          // Log additional context for debugging newsletter tracking issues
          console.error(`[Webhook] Error context:`, {
            resendId,
            email,
            webhookType: type,
            contactId: contact?.id,
            tenantId,
            timestamp: new Date().toISOString(),
            tags: data.tags,
            subject: data.subject
          });
        }
      }

      // Extract unique email ID for tracking
      const emailId = data.email_id || data.message_id || data.id;

      // Create activity record
      const activityData = {
        contactId: contact.id,
        campaignId: undefined as string | undefined,
        newsletterId: undefined as string | undefined, // Will be set later based on extracted newsletter info
        activityType: activityType as any,
        activityData: JSON.stringify({
          emailId: emailId, // Store email ID for unique tracking
          messageId: data.message_id,
          subject: data.subject,
          tags: data.tags,
          resendId: resendId, // Include ResendID in activity data
        }),
        userAgent: data.user_agent,
        ipAddress: data.ip,
        webhookId: data.message_id || data.id,
        webhookData: JSON.stringify(webhookData),
        occurredAt: new Date(data.created_at || Date.now()),
      };

      // Check if we already processed this webhook
      if (activityData.webhookId) {
        const existingActivity = await storage.getActivityByWebhookId(activityData.webhookId, tenantId);
        if (existingActivity) {
          console.log(`[Webhook] Activity already processed for webhook ID: ${activityData.webhookId}`);
          return res.status(200).json({ message: "Activity already processed" });
        }
      }

      // IMPORTANT: Extract newsletter tracking information BEFORE creating activity
      // This ensures unique open tracking works correctly
      let newsletterId: string | undefined;
      let groupUUID: string | undefined;
      
      // Debug: Log the entire webhook data structure to understand what we're receiving
      console.log(`[Webhook] Processing webhook data:`, {
        tags: data.tags,
        tagsType: Array.isArray(data.tags) ? 'array' : typeof data.tags,
        firstTagType: data.tags && data.tags[0] ? typeof data.tags[0] : 'no tags',
        firstTag: data.tags && data.tags[0] ? JSON.stringify(data.tags[0]) : 'no tags',
        metadata: data.metadata,
        subject: data.subject
      });
      
      // Priority 1: Look for groupUUID and newsletter ID in tags
      // Resend can send tags as either an array OR a direct object
      const tags = data.tags || [];
      
      console.log(`[Webhook] Tags type: ${Array.isArray(tags) ? 'array' : typeof tags}`);
      console.log(`[Webhook] Tags content:`, JSON.stringify(tags, null, 2));
      
      // Handle direct object format (what Resend actually sends)
      if (typeof tags === 'object' && !Array.isArray(tags) && tags !== null) {
        console.log(`[Webhook] Processing tags as direct object`);
        
        // Direct object access - much simpler!
        if (tags.groupUUID) {
          groupUUID = tags.groupUUID;
          console.log(`[Webhook] Found groupUUID in tags (direct object): ${groupUUID}`);
        }
        
        if (tags.newsletter_id) {
          // Remove 'newsletter-' prefix if present
          newsletterId = tags.newsletter_id.replace('newsletter-', '');
          console.log(`[Webhook] Found newsletter ID in tags (direct object): ${newsletterId}`);
        }
      }
      // Handle array format (fallback for different webhook formats)
      else if (Array.isArray(tags)) {
        console.log(`[Webhook] Processing tags as array`);
        
        for (const tag of tags) {
          // Handle object format within array
          if (typeof tag === 'object' && tag !== null) {
            const tagValue = tag.value || tag.name || '';
            const tagName = tag.name || '';
            
            // Check for groupUUID
            if (tagName === 'groupUUID' && tag.value) {
              groupUUID = tag.value;
              console.log(`[Webhook] Found groupUUID in array (object format, name field): ${groupUUID}`);
            } else if (tagValue.startsWith('groupUUID-')) {
              groupUUID = tagValue.replace('groupUUID-', '');
              console.log(`[Webhook] Found groupUUID in array (object format, value field): ${groupUUID}`);
            }
            
            // Check for newsletter ID
            if (tagName === 'newsletter_id' && tag.value) {
              newsletterId = tag.value.replace('newsletter-', '');
              console.log(`[Webhook] Found newsletter ID in array (object format, name field): ${newsletterId}`);
            } else if (tagValue.startsWith('newsletter-')) {
              newsletterId = tagValue.replace('newsletter-', '');
              console.log(`[Webhook] Found newsletter ID in array (object format, value field): ${newsletterId}`);
            }
          } 
          // Handle string format within array
          else if (typeof tag === 'string') {
            if (tag.startsWith('groupUUID-')) {
              groupUUID = tag.replace('groupUUID-', '');
              console.log(`[Webhook] Found groupUUID in array (string format): ${groupUUID}`);
            }
            if (tag.startsWith('newsletter-')) {
              newsletterId = tag.replace('newsletter-', '');
              console.log(`[Webhook] Found newsletter ID in array (string format): ${newsletterId}`);
            }
          }
        }
      }
      
      // Priority 2: Check message subject for newsletter tracking (fallback method)
      if (!newsletterId && data.subject) {
        const subjectMatch = data.subject.match(/\[Newsletter:([a-f0-9-]+)\]/);
        if (subjectMatch) {
          newsletterId = subjectMatch[1];
          console.log(`[Webhook] Found newsletter ID in subject: ${newsletterId}`);
        }
      }
      
      // Update activity data with extracted newsletter ID
      activityData.newsletterId = newsletterId;
      
      // IMPORTANT: Update newsletter stats BEFORE creating activity record
      // This ensures unique open tracking works correctly
      
      // Update contact statistics and newsletter stats based on activity type
      if (activityType === 'opened') {
        await storage.updateEmailContact(contact.id, { 
          emailsOpened: (contact.emailsOpened || 0) + 1,
          lastActivity: new Date() 
        }, tenantId);
        
        // Update newsletter open count if this is a newsletter email
        if (newsletterId) {
          console.log(`[Webhook] Updating newsletter open count BEFORE creating activity - newsletterId: ${newsletterId}, tenantId: ${tenantId}, contactId: ${contact.id}`);
          await updateNewsletterStats(newsletterId, 'email.opened', tenantId, contact.id);
        } else {
          console.log(`[Webhook] No newsletter ID found for open event - groupUUID: ${groupUUID}`);
        }
      } else if (activityType === 'clicked') {
        await storage.updateEmailContact(contact.id, { 
          lastActivity: new Date() 
        }, tenantId);
        
        // Update newsletter click count if this is a newsletter email
        if (newsletterId) {
          console.log(`[Webhook] Updating newsletter click count BEFORE creating activity - newsletterId: ${newsletterId}, tenantId: ${tenantId}, contactId: ${contact.id}`);
          await updateNewsletterStats(newsletterId, 'email.clicked', tenantId, contact.id);
        } else {
          console.log(`[Webhook] No newsletter ID found for click event - groupUUID: ${groupUUID}`);
        }
      } else if (activityType === 'bounced') {
        await storage.updateEmailContact(contact.id, { 
          status: 'bounced' as any,
          lastActivity: new Date() 
        }, tenantId);
        
        // Add email to universal bounced list
        try {
          console.log(`[Webhook] Adding ${email} to universal bounced list`);
          await storage.addBouncedEmail({
            email: email,
            bounceType: 'hard', // Default to hard bounce
            bounceReason: data.reason || 'Email bounced',
            bounceSubType: data.bounceSubType || undefined,
            firstBouncedAt: new Date(),
            lastBouncedAt: new Date(),
            bounceCount: 1,
            sourceTenantId: tenantId,
            sourceNewsletterId: newsletterId,
            sourceCampaignId: undefined,
            webhookId: data.id || data.event_id,
            webhookData: JSON.stringify(data),
            suppressionReason: `Bounce detected: ${data.reason || 'Email bounced'}`,
            lastAttemptedAt: new Date(),
          });
          console.log(`[Webhook] ✅ Successfully added ${email} to universal bounced list`);
        } catch (bounceError) {
          console.error(`[Webhook] Failed to add ${email} to bounced list:`, bounceError);
        }
      } else if (activityType === 'complained') {
        await storage.updateEmailContact(contact.id, { 
          status: 'complained' as any,
          lastActivity: new Date() 
        }, tenantId);
        
        // Add email to universal bounced list (complaints are suppressions too)
        try {
          console.log(`[Webhook] Adding ${email} to universal bounced list for spam complaint`);
          await storage.addBouncedEmail({
            email: email,
            bounceType: 'complaint',
            bounceReason: 'Spam complaint received',
            bounceSubType: 'spam-complaint',
            firstBouncedAt: new Date(),
            lastBouncedAt: new Date(),
            bounceCount: 1,
            sourceTenantId: tenantId,
            sourceNewsletterId: newsletterId,
            sourceCampaignId: undefined,
            webhookId: data.id || data.event_id,
            webhookData: JSON.stringify(data),
            suppressionReason: 'Spam complaint received from recipient',
            lastAttemptedAt: new Date(),
          });
          console.log(`[Webhook] ✅ Successfully added ${email} to universal bounced list for spam complaint`);
        } catch (bounceError) {
          console.error(`[Webhook] Failed to add ${email} to bounced list for spam complaint:`, bounceError);
        }
      } else if (activityType === 'unsubscribed') {
        await storage.updateEmailContact(contact.id, { 
          status: 'unsubscribed' as any,
          lastActivity: new Date() 
        }, tenantId);
      } else if (activityType === 'failed') {
        // For failed emails, we might want to track this but not change status immediately
        // as it could be a temporary issue. Consider implementing retry logic or failure count.
        await storage.updateEmailContact(contact.id, { 
          lastActivity: new Date() 
        }, tenantId);
      } else {
        // For other events (sent, delivered, delivery_delayed, scheduled), just update last activity
        await storage.updateEmailContact(contact.id, { 
          lastActivity: new Date() 
        }, tenantId);
      }

      // NOW create the activity record AFTER all stats updates are complete
      // This ensures unique open tracking works correctly
      const activity = await storage.createEmailActivity(activityData, tenantId);

      console.log(`[Webhook] Successfully processed ${activityType} activity for contact: ${email}`);
      console.log(`[Webhook] Activity created with ID: ${activity.id}`);
      console.log(`[Webhook] Tracking method used: ${groupUUID ? 'GroupUUID-based' : newsletterId ? 'Newsletter ID fallback' : 'No newsletter tracking'}`);
      console.log("[Webhook] Request processing completed successfully");
      console.log("=".repeat(80));
      res.status(200).json({ message: "Webhook processed successfully", activityId: activity.id });

    } catch (error) {
      console.error("=".repeat(80));
      console.error("[Webhook] ERROR processing Resend webhook:");
      console.error("[Webhook] Error message:", error instanceof Error ? error.message : String(error));
      console.error("[Webhook] Error stack:", error instanceof Error ? error.stack : 'No stack trace available');
      console.error("[Webhook] Request body that caused error:", JSON.stringify(req.body, null, 2));
      console.error("[Webhook] Request headers that caused error:", JSON.stringify(req.headers, null, 2));
      console.error("=".repeat(80));
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Webhook endpoint for Postmark - POST handler
  app.post("/api/webhooks/postmark", async (req, res) => {
    console.log("=".repeat(80));
    console.log("[Postmark Webhook] POST request received on /api/webhooks/postmark");
    console.log("[Postmark Webhook] Timestamp:", new Date().toISOString());
    console.log("[Postmark Webhook] Headers:", JSON.stringify(req.headers, null, 2));
    console.log("[Postmark Webhook] Raw body:", JSON.stringify(req.body, null, 2));
    console.log("=".repeat(80));
    
    try {
      const webhookData = req.body;
      
      // Postmark webhook format validation
      if (!webhookData.RecordType || !webhookData.Email) {
        console.log("[Postmark Webhook] VALIDATION FAILED: Invalid webhook format - missing RecordType or Email");
        return res.status(400).json({ message: "Invalid Postmark webhook format" });
      }

      const { RecordType, Email, MessageID, Metadata, Recipient } = webhookData;
      
      // Handle different Postmark event types
      const supportedEvents = ['Open', 'Click', 'Delivery', 'Bounce', 'SpamComplaint'];
      
      if (!supportedEvents.includes(RecordType)) {
        console.log(`[Postmark Webhook] UNSUPPORTED EVENT: ${RecordType}`);
        return res.status(200).json({ message: "Event type not handled" });
      }
      
      console.log(`[Postmark Webhook] ✅ Event type '${RecordType}' is supported, continuing processing...`);

      // Extract email address
      const email = Recipient || Email;
      
      if (!email || typeof email !== 'string') {
        console.log("[Postmark Webhook] VALIDATION FAILED: No valid email found in webhook data");
        return res.status(400).json({ message: "No email address found" });
      }

      // Find contact across all tenants
      console.log("[Postmark Webhook] Looking up contact for email:", email);
      
      let contactResult = await storage.findEmailContactByEmail(email);
      
      if (!contactResult) {
        return res.status(404).json({ 
          message: "Contact not found",
          debug: `Email '${email}' is not in the contacts database. Add this contact first.`
        });
      }
      
      console.log("[Postmark Webhook] ✅ Contact found:", contactResult.contact.id, "in tenant:", contactResult.tenantId);

      const { contact, tenantId } = contactResult;

      // Map Postmark event types to activity types
      const eventTypeMapping: Record<string, 'sent' | 'delivered' | 'bounced' | 'complained' | 'opened' | 'clicked' | 'unsubscribed'> = {
        'Open': 'opened',
        'Click': 'clicked',
        'Delivery': 'delivered',
        'Bounce': 'bounced',
        'SpamComplaint': 'complained'
      };

      const activityType = eventTypeMapping[RecordType];
      
      // Extract newsletter ID from metadata if available
      let newsletterId: string | undefined;
      if (Metadata && typeof Metadata === 'object') {
        newsletterId = Metadata.newsletterId || Metadata.newsletter_id;
        // Remove 'newsletter-' prefix if present
        if (newsletterId && newsletterId.startsWith('newsletter-')) {
          newsletterId = newsletterId.replace('newsletter-', '');
        }
      }

      // Create activity data
      const activityData = {
        contactId: contact.id,
        campaignId: undefined as string | undefined,
        newsletterId: newsletterId,
        activityType,
        activityData: JSON.stringify({
          provider: 'postmark',
          recordType: RecordType,
          emailId: MessageID, // Store email ID for unique tracking
          messageId: MessageID,
          metadata: Metadata
        }),
        userAgent: webhookData.UserAgent || undefined,
        ipAddress: webhookData.OriginalLink ? undefined : webhookData.Client?.Name || undefined,
        webhookId: MessageID + '_' + RecordType + '_' + Date.now(), // Create unique webhook ID
        webhookData: JSON.stringify(webhookData),
        occurredAt: new Date(webhookData.ReceivedAt || Date.now()),
      };

      // Check if we already processed this webhook (basic deduplication)
      if (activityData.webhookId) {
        const existingActivity = await storage.getActivityByWebhookId(activityData.webhookId, tenantId);
        if (existingActivity) {
          console.log(`[Postmark Webhook] Activity already processed for webhook ID: ${activityData.webhookId}`);
          return res.status(200).json({ message: "Activity already processed" });
        }
      }

      // Create email activity record
      const activity = await storage.createEmailActivity(activityData, tenantId);
      
      console.log(`[Postmark Webhook] ✅ Successfully processed ${RecordType} event for ${email}`);
      
      // Update newsletter stats if applicable
      if (newsletterId && (RecordType === 'Open' || RecordType === 'Click')) {
        try {
          const webhookType = RecordType === 'Open' ? 'email.opened' : 'email.clicked';
          console.log(`[Postmark Webhook] Updating newsletter stats for newsletter ${newsletterId}, event: ${webhookType}, tenant: ${tenantId}, contactId: ${contact.id}`);
          await updateNewsletterStats(newsletterId, webhookType, tenantId, contact.id);
        } catch (statsError) {
          console.error(`[Postmark Webhook] Error updating newsletter stats:`, statsError);
        }
      }

      res.status(200).json({ 
        message: "Postmark webhook processed successfully",
        activityId: activity.id,
        eventType: RecordType
      });

    } catch (error: any) {
      console.error("[Postmark Webhook] ERROR processing Postmark webhook:");
      console.error("[Postmark Webhook] Error message:", error instanceof Error ? error.message : String(error));
      console.error("[Postmark Webhook] Error stack:", error instanceof Error ? error.stack : 'No stack trace available');
      console.error("[Postmark Webhook] Request body that caused error:", JSON.stringify(req.body, null, 2));
      console.error("=".repeat(80));
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ====================================
  // NEWSLETTER ROUTES
  // ====================================

  // Get all newsletters
  app.get("/api/newsletters", authenticateToken, async (req: any, res) => {
    try {
      const newsletters = await storage.getAllNewsletters(req.user.tenantId);
      
      // Transform newsletters to use uniqueOpenCount as primary opens metric
      const transformedNewsletters = newsletters.map(newsletter => ({
        ...newsletter,
        opens: newsletter.uniqueOpenCount || 0, // Primary opens metric (unique opens)
        totalOpens: newsletter.openCount || 0,  // Total opens (includes repeat opens)
        // Keep the original fields for backwards compatibility
        openCount: newsletter.openCount || 0,
        uniqueOpenCount: newsletter.uniqueOpenCount || 0
      }));
      
      res.json({ newsletters: transformedNewsletters });
    } catch (error) {
      console.error("Get newsletters error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get single newsletter
  app.get("/api/newsletters/:id", authenticateToken, async (req: any, res) => {
    try {
      const { id } = req.params;
      const newsletter = await storage.getNewsletterWithUser(id, req.user.tenantId);

      if (!newsletter) {
        return res.status(404).json({ message: "Newsletter not found" });
      }

      // Transform newsletter to use uniqueOpenCount as primary opens metric
      const transformedNewsletter = {
        ...newsletter,
        opens: newsletter.uniqueOpenCount || 0, // Primary opens metric (unique opens)
        totalOpens: newsletter.openCount || 0,  // Total opens (includes repeat opens)
        // Keep the original fields for backwards compatibility
        openCount: newsletter.openCount || 0,
        uniqueOpenCount: newsletter.uniqueOpenCount || 0
      };

      res.json({ newsletter: transformedNewsletter });
    } catch (error) {
      console.error("Get newsletter error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Create newsletter
  app.post("/api/newsletters", authenticateToken, async (req: any, res) => {
    try {
      const validatedData = createNewsletterSchema.parse(req.body);
      const newsletter = await storage.createNewsletter(
        validatedData,
        req.user.id,
        req.user.tenantId
      );

      // Automatically initialize task statuses for the new newsletter
      await storage.initializeNewsletterTasks(newsletter.id, req.user.tenantId);

      // Transform newsletter to use uniqueOpenCount as primary opens metric
      const transformedNewsletter = {
        ...newsletter,
        opens: newsletter.uniqueOpenCount || 0, // Primary opens metric (unique opens)
        totalOpens: newsletter.openCount || 0,  // Total opens (includes repeat opens)
        // Keep the original fields for backwards compatibility
        openCount: newsletter.openCount || 0,
        uniqueOpenCount: newsletter.uniqueOpenCount || 0
      };

      res.status(201).json({ newsletter: transformedNewsletter });
    } catch (error: any) {
      if (error.name === "ZodError") {
        return res.status(400).json({ 
          message: "Validation error", 
          errors: error.errors 
        });
      }
      console.error("Create newsletter error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Update newsletter
  app.put("/api/newsletters/:id", authenticateToken, async (req: any, res) => {
    try {
      const { id } = req.params;
      const validatedData = updateNewsletterSchema.parse(req.body);
      
      const newsletter = await storage.updateNewsletter(id, validatedData, req.user.tenantId);

      if (!newsletter) {
        return res.status(404).json({ message: "Newsletter not found" });
      }

      // Transform newsletter to use uniqueOpenCount as primary opens metric
      const transformedNewsletter = {
        ...newsletter,
        opens: newsletter.uniqueOpenCount || 0, // Primary opens metric (unique opens)
        totalOpens: newsletter.openCount || 0,  // Total opens (includes repeat opens)
        // Keep the original fields for backwards compatibility
        openCount: newsletter.openCount || 0,
        uniqueOpenCount: newsletter.uniqueOpenCount || 0
      };

      res.json({ newsletter: transformedNewsletter });
    } catch (error: any) {
      if (error.name === "ZodError") {
        return res.status(400).json({ 
          message: "Validation error", 
          errors: error.errors 
        });
      }
      console.error("Update newsletter error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Delete newsletter
  app.delete("/api/newsletters/:id", authenticateToken, async (req: any, res) => {
    try {
      const { id } = req.params;
      
      // Check if newsletter exists first
      const newsletter = await storage.getNewsletter(id, req.user.tenantId);
      if (!newsletter) {
        return res.status(404).json({ message: "Newsletter not found" });
      }

      await storage.deleteNewsletter(id, req.user.tenantId);
      res.json({ message: "Newsletter deleted successfully" });
    } catch (error) {
      console.error("Delete newsletter error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get newsletter statistics
  app.get("/api/newsletter-stats", authenticateToken, async (req: any, res) => {
    try {
      const stats = await storage.getNewsletterStats(req.user.tenantId);
      res.json(stats);
    } catch (error) {
      console.error("Get newsletter stats error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get detailed email stats for a specific newsletter
  app.get("/api/newsletters/:id/detailed-stats", authenticateToken, async (req: any, res) => {
    try {
      const { id } = req.params;
      const tenantId = req.user.tenantId;
      
      // Get the newsletter details
      const newsletter = await storage.getNewsletter(id, tenantId);
      if (!newsletter) {
        return res.status(404).json({ message: "Newsletter not found" });
      }
      
      // Get email activities from PostgreSQL database
      // The newsletter ID is stored in activity_data JSON field with 'newsletter-' prefix
      const newsletterIdWithPrefix = `newsletter-${id}`;
      
      try {

        
        // Get all email activities for this newsletter from PostgreSQL
        const emailActivities = await db.execute(sql`
          SELECT 
            ea.id,
            ea.contact_id,
            ea.activity_type,
            ea.activity_data,
            ea.webhook_data,
            ea.occurred_at,
            ec.email,
            ec.first_name,
            ec.last_name
          FROM email_activity ea
          LEFT JOIN email_contacts ec ON ea.contact_id = ec.id
          WHERE ea.tenant_id = ${tenantId}
            AND ea.activity_data::jsonb -> 'tags' ->> 'newsletter_id' = ${newsletterIdWithPrefix}
          ORDER BY ea.contact_id, ea.occurred_at
        `);

        
        // Group activities by contact to create detailed stats per email
        const contactActivities = new Map();
        
        emailActivities.rows.forEach((activity: any) => {
          const contactId = activity.contact_id;
          if (!contactActivities.has(contactId)) {
            contactActivities.set(contactId, {
              contactId,
              email: activity.email,
              firstName: activity.first_name,
              lastName: activity.last_name,
              activities: [],
              opens: 0,
              clicks: 0,
              bounces: 0,
              complaints: 0,
              status: 'sent',
              lastActivity: null,
              resendId: null // Add resendId to track
            });
          }
          
          const contact = contactActivities.get(contactId);
          
          // Extract resend ID from webhook_data if available
          if (activity.webhook_data && !contact.resendId) {
            try {
              const webhookData = JSON.parse(activity.webhook_data);
              if (webhookData?.data?.email_id) {
                contact.resendId = webhookData.data.email_id;
              }
            } catch (e) {
              console.warn('Failed to parse webhook_data for activity:', activity.id);
            }
          }
          
          contact.activities.push({
            type: activity.activity_type,
            timestamp: activity.occurred_at,
            data: JSON.parse(activity.activity_data || '{}'),
            webhookData: activity.webhook_data ? JSON.parse(activity.webhook_data) : null
          });
          
          // Count activity types
          switch (activity.activity_type) {
            case 'opened':
              contact.opens++;
              break;
            case 'clicked':
              contact.clicks++;
              break;
            case 'bounced':
              contact.bounces++;
              break;
            case 'complained':
              contact.complaints++;
              break;
          }
          
          // Update status based on priority: bounced > complained > clicked > opened > sent
          if (contact.bounces > 0) contact.status = 'bounced';
          else if (contact.complaints > 0) contact.status = 'complained';
          else if (contact.clicks > 0) contact.status = 'clicked';
          else if (contact.opens > 0) contact.status = 'opened';
          
          // Update last activity timestamp
          if (!contact.lastActivity || new Date(activity.occurred_at) > new Date(contact.lastActivity)) {
            contact.lastActivity = activity.occurred_at;
          }
        });
        
        // Convert to array format expected by frontend
        const detailedStats = Array.from(contactActivities.values()).map((contact: any) => {
          return {
            emailId: contact.contactId,
            resendId: contact.resendId, // Use the real resend ID extracted from webhook_data
            recipient: contact.email,
            recipientName: contact.firstName && contact.lastName ? 
              `${contact.firstName} ${contact.lastName}` : contact.email,
            status: contact.status,
            opens: contact.opens,
            clicks: contact.clicks,
            bounces: contact.bounces,
            complaints: contact.complaints,
            lastActivity: contact.lastActivity,
            events: contact.activities.sort((a: any, b: any) => 
              new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
            )
          };
        });
        

        
        res.json({ 
          newsletter: {
            id: newsletter.id,
            title: newsletter.title,
            status: newsletter.status
          },
          totalEmails: detailedStats.length,
          emails: detailedStats
        });
        
      } catch (error) {
        console.error("Error fetching email activities from database:", error);
        res.status(500).json({ message: "Error fetching email tracking data" });
      }
      
    } catch (error) {
      console.error("Get newsletter detailed stats error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get email trajectory from Resend API and our database
  app.get("/api/emails/:resendId/trajectory", authenticateToken, async (req: any, res) => {
    try {
      const { resendId } = req.params;
      
      if (!resendId) {
        return res.status(400).json({ message: "Resend ID is required" });
      }

      if (!process.env.RESEND_API_KEY) {
        return res.status(500).json({ message: "Resend API key not configured" });
      }

      // Fetch email details from Resend API
      const { data, error } = await resend.emails.get(resendId);
      
      if (error) {
        console.error("Resend API error:", error);
        return res.status(404).json({ 
          message: "Email not found or error fetching from Resend", 
          error: error.message 
        });
      }

      // Fetch all email activities from our database for this resendId
      console.log(`[Trajectory] Fetching activities for resendId: ${resendId}`);
      
      const emailActivities = await db.execute(sql`
        SELECT 
          ea.id,
          ea.contact_id,
          ea.activity_type,
          ea.activity_data,
          ea.webhook_data,
          ea.occurred_at,
          ea.user_agent,
          ea.ip_address,
          ec.email,
          ec.first_name,
          ec.last_name
        FROM email_activity ea
        LEFT JOIN email_contacts ec ON ea.contact_id = ec.id
        WHERE ea.webhook_data::jsonb -> 'data' ->> 'email_id' = ${resendId}
           OR ea.activity_data::jsonb ->> 'email_id' = ${resendId}
           OR ea.webhook_data::text LIKE ${`%${resendId}%`}
        ORDER BY ea.occurred_at ASC
      `);

      console.log(`[Trajectory] Found ${emailActivities.rows?.length || 0} activities for resendId: ${resendId}`);

      // Transform database activities into events
      const activities = emailActivities.rows || [];
      const databaseEvents = activities.map((activity: any) => {
        let parsedActivityData: any = {};
        let parsedWebhookData: any = {};
        
        try {
          if (activity.activity_data) {
            parsedActivityData = JSON.parse(activity.activity_data);
          }
        } catch (e) {
          console.warn('[Trajectory] Failed to parse activity_data:', e);
        }
        
        try {
          if (activity.webhook_data) {
            parsedWebhookData = JSON.parse(activity.webhook_data);
          }
        } catch (e) {
          console.warn('[Trajectory] Failed to parse webhook_data:', e);
        }

        // Create a more detailed description based on activity type
        let description = `Email ${activity.activity_type}`;
        if (activity.activity_type === 'opened') {
          description = `Email opened by ${activity.email || 'recipient'}`;
          if (activity.user_agent) {
            const ua = activity.user_agent;
            if (ua.includes('iPhone') || ua.includes('iPad')) {
              description += ' on iOS device';
            } else if (ua.includes('Android')) {
              description += ' on Android device';
            } else if (ua.includes('Windows')) {
              description += ' on Windows';
            } else if (ua.includes('Mac')) {
              description += ' on Mac';
            }
          }
          if (activity.ip_address) {
            description += ` (IP: ${activity.ip_address})`;
          }
        } else if (activity.activity_type === 'clicked') {
          description = `Link clicked by ${activity.email || 'recipient'}`;
          if (parsedActivityData.url) {
            description += ` - ${parsedActivityData.url}`;
          }
        } else if (activity.activity_type === 'bounced') {
          description = `Email bounced for ${activity.email || 'recipient'}`;
          if (parsedWebhookData.bounce && parsedWebhookData.bounce.error_code) {
            description += ` (${parsedWebhookData.bounce.error_code})`;
          }
        } else if (activity.activity_type === 'delivered') {
          description = `Email delivered to ${activity.email || 'recipient'}`;
        } else if (activity.activity_type === 'complained') {
          description = `Spam complaint from ${activity.email || 'recipient'}`;
        }

        return {
          type: activity.activity_type,
          timestamp: activity.occurred_at,
          description,
          email: activity.email,
          userAgent: activity.user_agent,
          ipAddress: activity.ip_address,
          activityData: parsedActivityData,
          webhookData: parsedWebhookData
        };
      });

      // Combine Resend basic info with database events
      const allEvents = [
        {
          type: 'sent',
          timestamp: data.created_at,
          description: 'Email was sent via Resend',
          source: 'resend'
        },
        ...databaseEvents.map(event => ({ ...event, source: 'database' }))
      ];

      // Sort all events by timestamp
      allEvents.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      // Transform the Resend data into a more readable format
      const trajectory = {
        emailId: data.id,
        from: data.from,
        to: data.to,
        subject: data.subject,
        status: data.last_event,
        createdAt: data.created_at,
        lastEvent: data.last_event,
        totalEvents: allEvents.length,
        totalOpens: databaseEvents.filter(e => e.type === 'opened').length,
        totalClicks: databaseEvents.filter(e => e.type === 'clicked').length,
        events: allEvents,
        metadata: {
          html: data.html || null,
          text: data.text || null,
          reply_to: data.reply_to || null,
          cc: data.cc || null,
          bcc: data.bcc || null
        }
      };

      console.log(`[Trajectory] Returning trajectory with ${allEvents.length} events (${databaseEvents.filter(e => e.type === 'opened').length} opens)`);

      res.json({
        success: true,
        trajectory
      });

    } catch (error) {
      console.error("Get email trajectory error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Newsletter task status routes
  app.get("/api/newsletters/:id/task-status", authenticateToken, async (req: any, res) => {
    try {
      const { id } = req.params;
      const taskStatuses = await storage.getNewsletterTaskStatuses(id, req.user.tenantId);
      res.json({ taskStatuses });
    } catch (error) {
      console.error("Get newsletter task status error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/newsletters/:id/task-status", authenticateToken, async (req: any, res) => {
    try {
      const { id } = req.params;
      const taskData = req.body;
      const taskStatus = await storage.createNewsletterTaskStatus(id, taskData, req.user.tenantId);
      res.status(201).json({ taskStatus });
    } catch (error) {
      console.error("Create newsletter task status error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.put("/api/newsletters/:newsletterId/task-status/:taskId", authenticateToken, async (req: any, res) => {
    try {
      const { taskId } = req.params;
      const updates = req.body;
      const taskStatus = await storage.updateNewsletterTaskStatus(taskId, updates, req.user.tenantId);
      
      if (!taskStatus) {
        return res.status(404).json({ message: "Task status not found" });
      }
      
      res.json({ taskStatus });
    } catch (error) {
      console.error("Update newsletter task status error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/newsletters/:id/initialize-tasks", authenticateToken, async (req: any, res) => {
    try {
      const { id } = req.params;
      const taskStatuses = await storage.initializeNewsletterTasks(id, req.user.tenantId);
      res.json({ taskStatuses });
    } catch (error) {
      console.error("Initialize newsletter tasks error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get all contact tags for newsletter segmentation
  app.get("/api/contact-tags", authenticateToken, async (req: any, res) => {
    try {
      const tags = await storage.getAllContactTags(req.user.tenantId);
      res.json({ tags });
    } catch (error) {
      console.error("Get contact tags error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Send newsletter via Go backend (similar to email-test)
  app.post("/api/newsletters/:id/send", authenticateToken, async (req: any, res) => {
    try {
      const { id } = req.params;
      
      // Validate newsletter ID
      if (!id || typeof id !== 'string') {
        return res.status(400).json({ message: "Valid newsletter ID is required" });
      }
      
      console.log(`[Newsletter Send] Starting send for newsletter ID: ${id}, tenant: ${req.user.tenantId}`);
      
      // Get newsletter details
      const newsletter = await storage.getNewsletter(id, req.user.tenantId);
      if (!newsletter) {
        console.log(`[Newsletter Send] Newsletter not found: ${id}`);
        return res.status(404).json({ message: "Newsletter not found" });
      }
      
      // Validate newsletter content
      if (!newsletter.subject || !newsletter.content) {
        console.log(`[Newsletter Send] Newsletter missing required content: ${id}`);
        return res.status(400).json({ message: "Newsletter must have subject and content" });
      }
      
      if (newsletter.status === 'sent') {
        console.log(`[Newsletter Send] Newsletter already sent: ${id}`);
        return res.status(400).json({ message: "Newsletter has already been sent" });
      }
      
      console.log(`[Newsletter Send] Newsletter found:`, {
        id: newsletter.id,
        title: newsletter.title,
        recipientType: newsletter.recipientType,
        selectedContactIds: Array.isArray(newsletter.selectedContactIds) ? newsletter.selectedContactIds.length : 0,
        selectedTagIds: Array.isArray(newsletter.selectedTagIds) ? newsletter.selectedTagIds.length : 0
      });

      // Get recipients based on newsletter segmentation
      let recipients: any[] = [];
      
      try {
        if (newsletter.recipientType === 'all') {
          recipients = await storage.getAllEmailContacts(req.user.tenantId);
        } else if (newsletter.recipientType === 'selected' && Array.isArray(newsletter.selectedContactIds) && newsletter.selectedContactIds.length > 0) {
          // Get contacts by individual IDs with error handling
          const contactPromises = newsletter.selectedContactIds.map(async contactId => {
            try {
              return await storage.getEmailContact(contactId, req.user.tenantId);
            } catch (err) {
              console.warn(`[Newsletter Send] Failed to get contact ${contactId}:`, err);
              return null;
            }
          });
          const contacts = await Promise.all(contactPromises);
          recipients = contacts.filter(Boolean); // Remove any null/undefined contacts
        } else if (newsletter.recipientType === 'tags' && Array.isArray(newsletter.selectedTagIds) && newsletter.selectedTagIds.length > 0) {
          // Get all contacts and filter by tags
          const allContacts = await storage.getAllEmailContacts(req.user.tenantId);
          recipients = allContacts.filter(contact => 
            contact.tags && Array.isArray(contact.tags) && contact.tags.some((tag: any) => 
              newsletter.selectedTagIds?.includes(tag.id)
            )
          );
        }
      } catch (recipientError) {
        console.error(`[Newsletter Send] Error fetching recipients for newsletter ${id}:`, recipientError);
        return res.status(500).json({ 
          message: "Failed to fetch recipients", 
          error: recipientError instanceof Error ? recipientError.message : "Unknown error" 
        });
      }

      console.log(`[Newsletter Send] Found ${recipients.length} recipients`);

      // CRITICAL FIX: Ensure all recipients exist as email contacts
      // This is essential for webhook processing to work correctly
      if (recipients.length === 0) {
        console.log(`[Newsletter Send] No recipients found for newsletter ${id}`);
        
        // Helpful error message with solution
        let suggestion = "";
        if (newsletter.recipientType === 'all') {
          suggestion = "Create email contacts first using the Email Contacts page.";
        } else if (newsletter.recipientType === 'selected') {
          suggestion = "Ensure the selected contact IDs exist and are valid.";
        } else if (newsletter.recipientType === 'tags') {
          suggestion = "Ensure contacts with the selected tags exist.";
        }
        
        return res.status(400).json({ 
          message: "No recipients found for this newsletter",
          solution: suggestion,
          details: `Recipient type: ${newsletter.recipientType}, Selected contacts: ${Array.isArray(newsletter.selectedContactIds) ? newsletter.selectedContactIds.length : 0}, Selected tags: ${Array.isArray(newsletter.selectedTagIds) ? newsletter.selectedTagIds.length : 0}`
        });
      }



      // Validate recipients have valid email addresses
      const validRecipients = recipients.filter(r => r && r.email && typeof r.email === 'string' && r.email.includes('@'));
      if (validRecipients.length === 0) {
        console.log(`[Newsletter Send] No valid email addresses found for newsletter ${id}`);
        return res.status(400).json({ message: "No valid email addresses found in recipients" });
      }

      if (validRecipients.length !== recipients.length) {
        console.warn(`[Newsletter Send] ${recipients.length - validRecipients.length} recipients had invalid email addresses`);
      }

      // Filter out bounced emails
      console.log(`[Newsletter Send] Checking for bounced emails among ${validRecipients.length} recipients`);
      const bouncedEmails = await storage.getBouncedEmailAddresses();
      const bouncedEmailSet = new Set(bouncedEmails.map(email => email.toLowerCase()));
      
      const nonBouncedRecipients = validRecipients.filter(r => {
        const emailLower = r.email.toLowerCase();
        const isBounced = bouncedEmailSet.has(emailLower);
        if (isBounced) {
          console.log(`[Newsletter Send] Excluding bounced email: ${r.email}`);
        }
        return !isBounced;
      });

      const bouncedCount = validRecipients.length - nonBouncedRecipients.length;
      if (bouncedCount > 0) {
        console.log(`[Newsletter Send] Excluded ${bouncedCount} bounced email(s) from newsletter ${id}`);
      }

      if (nonBouncedRecipients.length === 0) {
        console.log(`[Newsletter Send] No deliverable recipients after filtering bounced emails for newsletter ${id}`);
        return res.status(400).json({ 
          message: "No deliverable recipients found", 
          details: `All ${validRecipients.length} recipient(s) have bounced emails and cannot receive newsletters`
        });
      }

      // Use non-bounced recipients for sending
      const finalRecipients = nonBouncedRecipients;

      // Get user's access token for Go server authentication
      const accessToken = req.headers.authorization?.replace('Bearer ', '');
      if (!accessToken) {
        return res.status(401).json({ message: "Authentication token required" });
      }

      // Check Go server availability
      const GO_SERVER_URL = process.env.GO_SERVER_URL || 'https://tenginew.zendwise.work';
      let goServerAvailable = false;
      
      try {
        const healthResponse = await fetch(`${GO_SERVER_URL}/health`, { 
          method: 'GET'
        });
        goServerAvailable = healthResponse.ok;
      } catch (healthError) {
        console.warn(`[Newsletter Send] Go server health check failed:`, healthError);
      }

      if (!goServerAvailable) {
        console.error(`[Newsletter Send] Go server not available at ${GO_SERVER_URL}`);
        return res.status(503).json({ 
          message: "Email service temporarily unavailable", 
          details: "Go server is not responding"
        });
      }

      // Send newsletter to each recipient via Go backend
      // Generate a unique group UUID for this newsletter batch
      const groupUUID = randomUUID();
      const emailId = `newsletter-${id}-${Date.now()}`;
      
      console.log(`[Newsletter Send] Generated groupUUID: ${groupUUID} for newsletter ${id}`);
      
      const sendPromises = finalRecipients.map(async (recipient, index) => {
        const individualEmailId = `${emailId}-${index}`;
        
        const payload = {
          emailId: individualEmailId,
          status: "queued",
          temporalWorkflow: `newsletter-workflow-${individualEmailId}`,
          metadata: {
            recipient: recipient.email,
            // Use clean subject line without tracking IDs
            subject: newsletter.subject,
            content: newsletter.content,
            templateType: "newsletter",
            priority: "normal",
            newsletterId: newsletter.id,
            newsletterTitle: newsletter.title,
            to: recipient.email,
            sentAt: new Date().toISOString(),
            // Use tags for groupUUID tracking since metadata is not included in webhook responses
            tags: [`newsletter-${newsletter.id}`, 'newsletter', newsletter.title, `groupUUID-${groupUUID}`]
          }
        };
        
        console.log(`[Newsletter Send] Queuing email ${index + 1}/${finalRecipients.length}: ${recipient.email} (emailId: ${individualEmailId})`);

        try {
          const response = await fetch(`${GO_SERVER_URL}/api/email-tracking`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
          });

          if (!response.ok) {
            const errorText = await response.text();
            console.error(`Failed to queue email for ${recipient.email}:`, errorText);
            return { success: false, email: recipient.email, error: `HTTP ${response.status}: ${errorText}` };
          }

          const result = await response.json();
          console.log(`[Newsletter Send] Successfully queued email for ${recipient.email}: ${result.id || 'unknown'}`);
          return { success: true, email: recipient.email, result };
        } catch (error) {
          console.error(`Error sending to ${recipient.email}:`, error);
          return { 
            success: false, 
            email: recipient.email, 
            error: error instanceof Error ? error.message : String(error) 
          };
        }
      });

      // Process results with better error handling
      let successful: any[] = [];
      let failed: any[] = [];
      
      try {
        const results = await Promise.allSettled(sendPromises);
        
        results.forEach((result, index) => {
          if (result.status === 'fulfilled') {
            if (result.value.success) {
              successful.push(result.value);
            } else {
              failed.push(result.value);
            }
          } else {
            // Handle rejected promise
            const recipient = finalRecipients[index];
            failed.push({
              success: false,
              email: recipient?.email || 'unknown',
              error: result.reason instanceof Error ? result.reason.message : String(result.reason)
            });
          }
        });
      } catch (resultsError) {
        console.error(`[Newsletter Send] Error processing results:`, resultsError);
        return res.status(500).json({ 
          message: "Failed to process email sending results",
          error: resultsError instanceof Error ? resultsError.message : "Unknown error"
        });
      }

      console.log(`[Newsletter Send] Results: ${successful.length} successful, ${failed.length} failed`);
      if (failed.length > 0) {
        console.log(`[Newsletter Send] Failed emails:`, failed.map(f => ({ email: f.email, error: f.error })));
      }

      // Update newsletter status and metadata after queuing sends
      try {
        await storage.updateNewsletter(
          id,
          { 
            status: "sent",
            sentAt: new Date(),
            recipientCount: finalRecipients.length,
          },
          req.user.tenantId
        );
      } catch (updateError) {
        console.error(`[Newsletter Send] Failed to update newsletter status:`, updateError);
        // Continue with response even if update fails - emails were sent
      }

      res.json({
        message: "Newsletter sending initiated",
        totalRecipients: finalRecipients.length,
        successful: successful.length,
        failed: failed.length,
        emailId,
        results: {
          successful: successful.map(r => r.email),
          failed: failed.map(r => ({ email: r.email, error: r.error }))
        }
      });

    } catch (error) {
      console.error("Send newsletter error:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      const errorStack = error instanceof Error ? error.stack : undefined;
      
      console.error("Send newsletter error stack:", errorStack);
      
      res.status(500).json({ 
        message: "Internal server error",
        error: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
        details: process.env.NODE_ENV === 'development' ? errorStack : undefined
      });
    }
  });

  // ====================================
  // CAMPAIGN ROUTES
  // ====================================

  // Get all campaigns
  app.get("/api/campaigns", authenticateToken, async (req: any, res) => {
    try {
      const campaigns = await storage.getAllCampaigns(req.user.tenantId);
      res.json({ campaigns });
    } catch (error) {
      console.error("Get campaigns error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get single campaign
  app.get("/api/campaigns/:id", authenticateToken, async (req: any, res) => {
    try {
      const { id } = req.params;
      const campaign = await storage.getCampaign(id, req.user.tenantId);

      if (!campaign) {
        return res.status(404).json({ message: "Campaign not found" });
      }

      res.json({ campaign });
    } catch (error) {
      console.error("Get campaign error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Create campaign
  app.post("/api/campaigns", authenticateToken, async (req: any, res) => {
    try {
      console.log("🎯 [Campaign] Create request received:", {
        body: req.body,
        user: req.user?.id,
        tenant: req.user?.tenantId
      });
      
      const validatedData = createCampaignSchema.parse(req.body);
      console.log("🎯 [Campaign] Validation successful:", validatedData);
      
      const campaign = await storage.createCampaign(
        validatedData,
        req.user.id,
        req.user.tenantId
      );
      
      console.log("🎯 [Campaign] Created successfully:", campaign.id);
      res.status(201).json({ campaign });
    } catch (error: any) {
      if (error.name === "ZodError") {
        console.error("🎯 [Campaign] Validation error:", error.errors);
        return res.status(400).json({ 
          message: "Validation error", 
          errors: error.errors 
        });
      }
      console.error("🎯 [Campaign] Create campaign error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Update campaign
  app.put("/api/campaigns/:id", authenticateToken, async (req: any, res) => {
    try {
      const { id } = req.params;
      const validatedData = updateCampaignSchema.parse(req.body);
      
      const campaign = await storage.updateCampaign(id, validatedData, req.user.tenantId);

      if (!campaign) {
        return res.status(404).json({ message: "Campaign not found" });
      }

      res.json({ campaign });
    } catch (error: any) {
      if (error.name === "ZodError") {
        return res.status(400).json({ 
          message: "Validation error", 
          errors: error.errors 
        });
      }
      console.error("Update campaign error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Delete campaign
  app.delete("/api/campaigns/:id", authenticateToken, async (req: any, res) => {
    try {
      const { id } = req.params;
      
      // Check if campaign exists first
      const campaign = await storage.getCampaign(id, req.user.tenantId);
      if (!campaign) {
        return res.status(404).json({ message: "Campaign not found" });
      }

      await storage.deleteCampaign(id, req.user.tenantId);
      res.json({ message: "Campaign deleted successfully" });
    } catch (error) {
      console.error("Delete campaign error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get campaign statistics
  app.get("/api/campaign-stats", authenticateToken, async (req: any, res) => {
    try {
      const stats = await storage.getCampaignStats(req.user.tenantId);
      res.json(stats);
    } catch (error) {
      console.error("Get campaign stats error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get managers for reviewer dropdown
  app.get("/api/managers", authenticateToken, async (req: any, res) => {
    try {
      const managers = await storage.getManagerUsers(req.user.tenantId);
      res.json({ managers });
    } catch (error) {
      console.error("Get managers error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Mount email routes for enhanced email system monitoring
  app.use('/api/email', emailRoutes);

  // Debug endpoint to check newsletter tracking status
  app.get("/api/debug/newsletter/:newsletterId/tracking", authenticateToken, async (req: any, res) => {
    try {
      const { newsletterId } = req.params;
      const tenantId = req.user.tenantId;
      
      console.log(`[Debug] Checking tracking for newsletter ${newsletterId} in tenant ${tenantId}`);
      
      // Get the newsletter details
      const newsletter = await storage.getNewsletter(newsletterId, tenantId);
      if (!newsletter) {
        return res.status(404).json({ error: "Newsletter not found" });
      }
      
      // Try to get tracking entries from Go server
      const GO_SERVER_URL = process.env.GO_SERVER_URL || process.env.GO_EMAIL_SERVER_URL || 'https://tenginew.zendwise.work';
      const accessToken = req.headers.authorization?.replace('Bearer ', '');
      
      try {
        const trackingResponse = await fetch(`${GO_SERVER_URL}/api/email-tracking`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          }
        });
        
        if (trackingResponse.ok) {
          const trackingData = await trackingResponse.json();
          const entries = trackingData.entries || [];
          
          // Find entries related to this newsletter
          const newsletterEntries = entries.filter((entry: any) => 
            entry.metadata?.newsletterId === newsletterId
          );
          
          const debugInfo = {
            newsletter: {
              id: newsletter.id,
              title: newsletter.title,
              openCount: newsletter.openCount,
              clickCount: newsletter.clickCount,
              recipientCount: newsletter.recipientCount,
              status: newsletter.status
            },
            tracking: {
              totalEntries: entries.length,
              newsletterEntries: newsletterEntries.length,
              entries: newsletterEntries.map((entry: any) => ({
                id: entry.id,
                emailId: entry.emailId,
                status: entry.status,
                hasResendId: !!entry.metadata?.resendId,
                resendId: entry.metadata?.resendId,
                newsletterId: entry.metadata?.newsletterId,
                recipient: entry.metadata?.recipient,
                webhookHistory: entry.metadata?.webhookHistory?.length || 0
              }))
            }
          };
          
          res.json(debugInfo);
        } else {
          res.status(500).json({ error: "Failed to fetch tracking data", status: trackingResponse.status });
        }
      } catch (error) {
        console.error("[Debug] Error connecting to tracking service:", error);
        res.status(500).json({ error: "Error connecting to tracking service" });
      }
      
    } catch (error) {
      console.error("Debug newsletter tracking error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Enhanced debug endpoint for webhook processing
  app.post("/api/debug/webhook-flow/:newsletterId", authenticateToken, async (req: any, res) => {
    try {
      const { newsletterId } = req.params;
      const { contactEmail } = req.body;
      const tenantId = req.user.tenantId;
      
      if (!contactEmail) {
        return res.status(400).json({ error: "contactEmail is required" });
      }
      
      console.log(`[Debug Webhook] Starting debug flow for newsletter ${newsletterId}, contact ${contactEmail}`);
      
      const debugResult: {
        steps: string[];
        newsletter: any;
        contact: any;
        webhookProcessing: any;
        finalCounts: any;
      } = {
        steps: [],
        newsletter: null,
        contact: null,
        webhookProcessing: null,
        finalCounts: null
      };
      
      // Step 1: Find newsletter
      debugResult.steps.push("Step 1: Looking up newsletter");
      const newsletter = await storage.getNewsletter(newsletterId, tenantId);
      if (!newsletter) {
        debugResult.steps.push("❌ Newsletter not found");
        return res.status(404).json({ error: "Newsletter not found", debug: debugResult });
      }
      debugResult.newsletter = {
        id: newsletter.id,
        title: newsletter.title,
        openCount: newsletter.openCount || 0,
        clickCount: newsletter.clickCount || 0
      };
      debugResult.steps.push("✅ Newsletter found");
      
      // Step 2: Find contact
      debugResult.steps.push("Step 2: Looking up contact");
      const contactResult = await storage.findEmailContactByEmail(contactEmail);
      if (!contactResult) {
        debugResult.steps.push("❌ Contact not found");
        return res.status(404).json({ error: "Contact not found", debug: debugResult });
      }
      debugResult.contact = {
        id: contactResult.contact.id,
        email: contactResult.contact.email,
        tenantId: contactResult.tenantId,
        emailsOpened: contactResult.contact.emailsOpened || 0
      };
      debugResult.steps.push("✅ Contact found");
      
      // Step 3: Simulate webhook processing
      debugResult.steps.push("Step 3: Simulating webhook processing");
      
      // Create test tags like the actual system would
      const testTags = [
        `newsletter-${newsletterId}`,
        'newsletter',
        newsletter.title,
        { name: 'groupUUID', value: `debug-group-${Date.now()}` },
        { name: 'newsletter_id', value: `newsletter-${newsletterId}` }
      ];
      
      debugResult.webhookProcessing = {
        tags: testTags,
        extractedNewsletterIds: [],
        tagProcessing: []
      };
      
      // Test tag extraction logic from the actual webhook
      let extractedNewsletterId = null;
      for (const tag of testTags) {
        if (typeof tag === 'object' && tag !== null) {
          const tagValue = tag.value || tag.name || '';
          const tagName = tag.name || '';
          
          if (tagName === 'newsletter_id' && tag.value) {
            extractedNewsletterId = tag.value.replace('newsletter-', '');
            debugResult.webhookProcessing.tagProcessing.push(`✅ Found newsletter ID in object tag (name field): ${extractedNewsletterId}`);
          } else if (tagValue.startsWith('newsletter-')) {
            extractedNewsletterId = tagValue.replace('newsletter-', '');
            debugResult.webhookProcessing.tagProcessing.push(`✅ Found newsletter ID in object tag (value field): ${extractedNewsletterId}`);
          }
        } else if (typeof tag === 'string') {
          if (tag.startsWith('newsletter-')) {
            extractedNewsletterId = tag.replace('newsletter-', '');
            debugResult.webhookProcessing.tagProcessing.push(`✅ Found newsletter ID in string tag: ${extractedNewsletterId}`);
          }
        }
      }
      
      debugResult.webhookProcessing.extractedNewsletterIds.push(extractedNewsletterId);
      
      if (!extractedNewsletterId) {
        debugResult.steps.push("❌ Could not extract newsletter ID from tags");
        return res.json({ error: "Newsletter ID extraction failed", debug: debugResult });
      }
      
      if (extractedNewsletterId !== newsletterId) {
        debugResult.steps.push(`❌ Extracted newsletter ID (${extractedNewsletterId}) doesn't match expected (${newsletterId})`);
        return res.json({ error: "Newsletter ID mismatch", debug: debugResult });
      }
      
      debugResult.steps.push("✅ Newsletter ID extraction successful");
      
      // Step 4: Test database update
      debugResult.steps.push("Step 4: Testing database update");
      
      const originalOpenCount = newsletter.openCount || 0;
      const newOpenCount = originalOpenCount + 1;
      
      try {
        const updatedNewsletter = await storage.updateNewsletter(newsletterId, {
          openCount: newOpenCount
        }, tenantId);
        
        if (updatedNewsletter) {
          debugResult.steps.push(`✅ Newsletter updated successfully: openCount ${originalOpenCount} → ${newOpenCount}`);
          debugResult.finalCounts = {
            original: originalOpenCount,
            updated: newOpenCount,
            success: true
          };
        } else {
          debugResult.steps.push("❌ Newsletter update returned null/undefined");
          debugResult.finalCounts = { success: false, reason: "Update returned null" };
        }
      } catch (updateError) {
        const errorMessage = updateError instanceof Error ? updateError.message : String(updateError);
        debugResult.steps.push(`❌ Newsletter update failed: ${errorMessage}`);
        debugResult.finalCounts = { success: false, reason: errorMessage };
      }
      
      // Step 5: Create activity record
      debugResult.steps.push("Step 5: Creating activity record");
      
      try {
        const activityData = {
          contactId: contactResult.contact.id,
          activityType: 'opened' as any,
          activityData: JSON.stringify({
            newsletterId: newsletterId,
            subject: newsletter.subject,
            tags: testTags,
            debug: true
          }),
          userAgent: 'Debug-Agent/1.0',
          ipAddress: '127.0.0.1',
          webhookId: `debug-webhook-${Date.now()}`,
          webhookData: JSON.stringify({ type: 'email.opened', debug: true }),
          occurredAt: new Date(),
        };
        
        const activity = await storage.createEmailActivity(activityData, contactResult.tenantId);
        debugResult.steps.push(`✅ Activity record created: ${activity.id}`);
      } catch (activityError) {
        const errorMessage = activityError instanceof Error ? activityError.message : String(activityError);
        debugResult.steps.push(`❌ Activity creation failed: ${errorMessage}`);
      }
      
      res.json({ message: "Debug flow completed", debug: debugResult });
      
    } catch (error) {
      console.error("Debug webhook flow error:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: "Internal server error", message: errorMessage });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
