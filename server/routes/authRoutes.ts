import { Router } from 'express';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { randomBytes, randomUUID } from 'crypto';
import { authenticator } from 'otplib';
import * as QRCode from 'qrcode';
import { UAParser } from 'ua-parser-js';
import { createHash, createHmac } from 'crypto';
import { emailService } from '../emailService';
import { Resend } from 'resend';
import {
  users,
  tenants,
  refreshTokens,
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
  type UserRole,
} from '@shared/schema';
import {
  sanitizeUserInput,
  sanitizeEmail,
  sanitizePassword,
  sanitizeName,
  sanitizeString,
  checkRateLimit,
  clearRateLimit,
  getClientIP,
} from '../utils/sanitization';
import { authRateLimiter } from '../middleware/security';
import { avatarUpload, handleUploadError } from '../middleware/upload';
import { R2_CONFIG, uploadToR2, deleteFromR2 } from '../config/r2';
import sharp from 'sharp';

const resend = new Resend(process.env.RESEND_API_KEY);

const JWT_SECRET = process.env.JWT_SECRET || "your-super-secret-jwt-key";
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || "your-super-secret-refresh-key";

export const authRoutes = Router();


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
    ipAddress: req.ip,
  };
}

// Middleware to verify JWT token
function authenticateToken(req: any, res: any, next: any) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) {
      return res.status(403).json({ message: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
}

// Middleware to check user permissions
function requireRole(allowedRoles: UserRole | UserRole[]) {
  return (req: any, res: any, next: any) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const userRole = req.user.role;
    const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

    if (!roles.includes(userRole)) {
      return res.status(403).json({ message: 'Insufficient permissions' });
    }

    next();
  };
}

// Register endpoint - Disabled for multi-tenant system
// Users should be invited by organization owners
authRoutes.post("/register", async (req, res) => {
  res.status(403).json({ 
    message: 'Direct registration is disabled. Please contact your organization administrator for an invitation.' 
  });
});

// Register owner endpoint
authRoutes.post("/register-owner", async (req, res) => {
  try {
    const validatedData = registerOwnerSchema.parse(req.body);
    const { email, password, firstName, lastName, organizationName, organizationSlug } = validatedData;

    // Sanitize inputs
    const sanitizedEmail = sanitizeEmail(email);
    const sanitizedPassword = sanitizePassword(password);
    const sanitizedFirstName = sanitizeName(firstName);
    const sanitizedLastName = sanitizeName(lastName);
    const sanitizedOrganizationName = sanitizeString(organizationName);
    const sanitizedOrganizationSlug = sanitizeString(organizationSlug);

    // Check rate limiting
    const clientIP = getClientIP(req);
    if (!(await checkRateLimit(`register-owner:${clientIP}`, 3, 15 * 60 * 1000))) {
      return res.status(429).json({ message: 'Too many owner registration attempts' });
    }

    // Check if user already exists
    const existingUser = await db.query.users.findFirst({
      where: sql`${users.email} = ${sanitizedEmail}`,
    });

    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Check if tenant slug already exists
    const existingTenant = await db.query.tenants.findFirst({
      where: sql`${tenants.slug} = ${sanitizedOrganizationSlug}`,
    });

    if (existingTenant) {
      return res.status(400).json({ message: 'Organization identifier already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(sanitizedPassword, 12);

    // Create tenant first
    const newTenant = await db.insert(tenants).values({
      name: sanitizedOrganizationName,
      slug: sanitizedOrganizationSlug,
      isActive: true,
    }).returning();

    // Create user
    const newUser = await db.insert(users).values({
      tenantId: newTenant[0].id,
      email: sanitizedEmail,
      password: hashedPassword,
      firstName: sanitizedFirstName,
      lastName: sanitizedLastName,
      role: 'Owner',
      emailVerified: false,
      emailVerificationToken: randomUUID(),
    }).returning();

    // Send verification email
    try {
      await emailService.sendVerificationEmail(sanitizedEmail, newUser[0].emailVerificationToken!);
    } catch (emailError) {
      console.error('Failed to send verification email:', emailError);
      // Don't fail registration if email fails
    }

    // Clear rate limit on successful registration
    await clearRateLimit(`register-owner:${clientIP}`);

    res.status(201).json({
      message: 'Owner registered successfully. Please check your email for verification.',
      userId: newUser[0].id,
    });
  } catch (error) {
    console.error('Owner registration error:', error);
    res.status(500).json({ message: 'Owner registration failed' });
  }
});

// Login endpoint
authRoutes.post("/login", async (req, res) => {
  try {

    // Check if request body exists and has content
    if (!req.body || Object.keys(req.body).length === 0) {
      return res.status(400).json({ message: 'Request body is required' });
    }

    let validatedData;
    try {
      validatedData = loginSchema.parse(req.body);
    } catch (validationError) {
      console.error('Login validation error:', validationError);
      console.error('Validation error details:', {
        error: validationError,
        body: req.body,
        bodyType: typeof req.body,
        bodyKeys: req.body ? Object.keys(req.body) : 'no body'
      });
      
      // Check if the error is specifically about missing email
      if (validationError instanceof Error && validationError.message.includes('email')) {
        return res.status(400).json({ 
          message: 'Email is required', 
          details: 'Please provide a valid email address'
        });
      }
      
      return res.status(400).json({ 
        message: 'Invalid login data', 
        details: validationError instanceof Error ? validationError.message : 'Validation failed'
      });
    }
    
    // Debug validated data structure
    console.log('Validated data structure:', {
      hasEmail: 'email' in validatedData,
      hasPassword: 'password' in validatedData,
      hasRememberMe: 'rememberMe' in validatedData,
      keys: Object.keys(validatedData),
      emailValue: validatedData.email,
      emailType: typeof validatedData.email
    });

    const { email, password, rememberMe } = validatedData;

    // Debug logging
    console.log('Validated data:', {
      email: email,
      password: password ? '[REDACTED]' : 'undefined',
      rememberMe: rememberMe,
      emailType: typeof email,
      emailUndefined: email === undefined
    });

    // Sanitize inputs
    const sanitizedEmail = sanitizeEmail(email);
    const sanitizedPassword = sanitizePassword(password);

    // Debug sanitized values
    console.log('Sanitized values:', {
      sanitizedEmail: sanitizedEmail,
      sanitizedEmailType: typeof sanitizedEmail,
      sanitizedPassword: sanitizedPassword ? '[REDACTED]' : 'undefined',
      sanitizedPasswordType: typeof sanitizedPassword
    });

    // Validate sanitized inputs
    if (!sanitizedEmail) {
      return res.status(400).json({ message: 'Valid email is required' });
    }
    if (!sanitizedPassword) {
      return res.status(400).json({ message: 'Password is required' });
    }

    // Check rate limiting
    const clientIP = getClientIP(req);
    if (!(await checkRateLimit(`login:${clientIP}`, 50, 15 * 60 * 1000))) {
      return res.status(429).json({ message: 'Too many login attempts' });
    }

    // Debug database objects
    console.log('Database objects:', {
      hasDb: !!db,
      hasDbQuery: !!db.query,
      hasDbQueryUsers: !!db.query.users,
      hasUsersTable: !!users,
      sanitizedEmail: sanitizedEmail
    });

    // Test database connection
    try {
      await db.execute(sql`SELECT 1`);
      console.log('Database connection test: SUCCESS');
    } catch (connError) {
      console.error('Database connection test: FAILED', connError);
      return res.status(500).json({ message: 'Database connection failed' });
    }

    // Find user
    let user;
    try {
      user = await db.query.users.findFirst({
        where: sql`${users.email} = ${sanitizedEmail}`,
        with: {
          tenant: true,
        },
      });
    } catch (dbError) {
      console.error('Database query error:', dbError);
      console.error('Database error details:', {
        name: dbError instanceof Error ? dbError.name : 'Unknown',
        message: dbError instanceof Error ? dbError.message : String(dbError),
        stack: dbError instanceof Error ? dbError.stack : undefined
      });
      return res.status(500).json({ message: 'Database error during login' });
    }

    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Check if email is verified
    if (!user.emailVerified) {
      return res.status(401).json({ message: 'Please verify your email before logging in' });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(sanitizedPassword, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Get device info
    const deviceInfo = getDeviceInfo(req);

    // Generate tokens
    const tokenExpiry = rememberMe ? '30d' : '1d';
    const refreshTokenExpiry = rememberMe ? '90d' : '7d';

    const accessToken = jwt.sign(
      { 
        userId: user.id, 
        email: user.email, 
        role: user.role,
        tenantId: user.tenantId,
        tenantSlug: user.tenant?.slug 
      },
      JWT_SECRET,
      { expiresIn: tokenExpiry }
    );

    const refreshToken = jwt.sign(
      { userId: user.id, type: 'refresh' },
      REFRESH_TOKEN_SECRET,
      { expiresIn: refreshTokenExpiry }
    );

    // Store session
    const sessionId = randomUUID();
    await db.insert(refreshTokens).values({
      id: sessionId,
      tenantId: user.tenantId,
      userId: user.id,
      deviceId: deviceInfo.deviceId,
      deviceName: deviceInfo.deviceName,
      userAgent: deviceInfo.userAgent,
      ipAddress: deviceInfo.ipAddress,
      token: refreshToken,
      expiresAt: new Date(Date.now() + (rememberMe ? 90 * 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000)),
    });

    // Clear rate limit on successful login
    await clearRateLimit(`login:${clientIP}`);

    // Set secure cookies
    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: rememberMe ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000,
    });

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: rememberMe ? 90 * 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000,
    });

    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        tenantId: user.tenantId,
        tenantSlug: user.tenant?.slug,
        emailVerified: user.emailVerified,
        twoFactorEnabled: user.twoFactorEnabled,
        theme: user.theme,
        avatarUrl: user.avatarUrl,
      },
      accessToken,
    });
  } catch (error) {
    console.error('Login error:', error);
    console.error('Error details:', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      reqBody: req.body,
      reqBodyType: typeof req.body
    });
    res.status(500).json({ message: 'Login failed' });
  }
});

// Email verification endpoint
authRoutes.get("/verify-email", async (req, res) => {
  try {
    const { token } = req.query;

    if (!token || typeof token !== 'string') {
      return res.status(400).json({ message: 'Verification token required' });
    }

    const user = await db.query.users.findFirst({
      where: sql`${users.emailVerificationToken} = ${token}`,
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid verification token' });
    }

    if (user.emailVerified) {
      return res.status(400).json({ message: 'Email already verified' });
    }

    // Update user as verified
    await db.update(users)
      .set({ 
        emailVerified: true, 
        emailVerificationToken: null,
        updatedAt: new Date(),
      })
      .where(sql`${users.id} = ${user.id}`);

    res.json({ message: 'Email verified successfully' });
  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({ message: 'Email verification failed' });
  }
});

// Resend verification email endpoint
authRoutes.post("/resend-verification", async (req, res) => {
  try {
    const validatedData = resendVerificationSchema.parse(req.body);
    const { email } = validatedData;

    const sanitizedEmail = sanitizeEmail(email);

    // Check rate limiting
    const clientIP = getClientIP(req);
    if (!(await checkRateLimit(`resend-verification:${clientIP}`, 3, 15 * 60 * 1000))) {
      return res.status(429).json({ message: 'Too many verification email requests' });
    }

    const user = await db.query.users.findFirst({
      where: sql`${users.email} = ${sanitizedEmail}`,
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.emailVerified) {
      return res.status(400).json({ message: 'Email already verified' });
    }

    // Generate new verification token
    const newToken = randomUUID();
    await db.update(users)
      .set({ emailVerificationToken: newToken })
      .where(sql`${users.id} = ${user.id}`);

    // Send verification email
    try {
      await emailService.sendVerificationEmail(sanitizedEmail, newToken);
      res.json({ message: 'Verification email sent' });
    } catch (emailError) {
      console.error('Failed to send verification email:', emailError);
      res.status(500).json({ message: 'Failed to send verification email' });
    }
  } catch (error) {
    console.error('Resend verification error:', error);
    res.status(500).json({ message: 'Failed to resend verification email' });
  }
});

// Development email verification endpoint
authRoutes.post("/dev-verify-email", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Email required' });
    }

    const sanitizedEmail = sanitizeEmail(email);

    const user = await db.query.users.findFirst({
      where: sql`${users.email} = ${sanitizedEmail}`,
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Update user as verified
    await db.update(users)
      .set({ 
        emailVerified: true, 
        emailVerificationToken: null,
        updatedAt: new Date(),
      })
      .where(sql`${users.id} = ${user.id}`);

    res.json({ message: 'Email verified successfully (dev mode)' });
  } catch (error) {
    console.error('Dev email verification error:', error);
    res.status(500).json({ message: 'Email verification failed' });
  }
});

// Refresh token endpoint
authRoutes.post("/refresh", async (req, res) => {
  try {
    const { refreshToken } = req.cookies;

    if (!refreshToken) {
      return res.status(401).json({ message: 'Refresh token required' });
    }

    // Verify refresh token
    const decoded = jwt.verify(refreshToken, REFRESH_TOKEN_SECRET) as any;
    
    if (decoded.type !== 'refresh') {
      return res.status(401).json({ message: 'Invalid refresh token' });
    }

    // Find session
    const session = await db.query.refreshTokens.findFirst({
      where: sql`${refreshTokens.token} = ${refreshToken}`,
      with: {
        user: {
          with: {
            tenant: true,
          },
        },
      },
    });

    if (!session || session.expiresAt < new Date()) {
      return res.status(401).json({ message: 'Invalid or expired refresh token' });
    }

    // Generate new access token
    const accessToken = jwt.sign(
      { 
        userId: session.user.id, 
        email: session.user.email, 
        role: session.user.role,
        tenantId: session.user.tenantId,
        tenantSlug: session.user.tenant?.slug 
      },
      JWT_SECRET,
      { expiresIn: '1d' }
    );

    // Set new access token cookie
    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000,
    });

    res.json({
      message: 'Token refreshed successfully',
      accessToken,
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(401).json({ message: 'Token refresh failed' });
  }
});

// Logout endpoint
authRoutes.post("/logout", authenticateToken, async (req: any, res) => {
  try {
    const { refreshToken } = req.cookies;

    if (refreshToken) {
      // Remove session from database
      await db.delete(refreshTokens)
        .where(sql`${refreshTokens.token} = ${refreshToken}`);
    }

    // Clear cookies
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');

    res.json({ message: 'Logout successful' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ message: 'Logout failed' });
  }
});

// Check authentication status
authRoutes.get("/check", async (req, res) => {
  try {
    const { accessToken, refreshToken } = req.cookies;

    if (!accessToken && !refreshToken) {
      return res.json({ authenticated: false });
    }

    // Try to verify access token first
    if (accessToken) {
      try {
        const decoded = jwt.verify(accessToken, JWT_SECRET) as any;
        return res.json({ 
          authenticated: true, 
          user: {
            userId: decoded.userId,
            email: decoded.email,
            role: decoded.role,
            tenantId: decoded.tenantId,
            tenantSlug: decoded.tenantSlug,
          }
        });
      } catch (error) {
        // Access token is invalid, try refresh token
      }
    }

    // Try to refresh using refresh token
    if (refreshToken) {
      try {
        const decoded = jwt.verify(refreshToken, REFRESH_TOKEN_SECRET) as any;
        
        if (decoded.type === 'refresh') {
          const session = await db.query.refreshTokens.findFirst({
            where: sql`${refreshTokens.token} = ${refreshToken}`,
            with: {
              user: {
                with: {
                  tenant: true,
                },
              },
            },
          });

          if (session && session.expiresAt > new Date()) {
            // Generate new access token
            const newAccessToken = jwt.sign(
              { 
                userId: session.user.id, 
                email: session.user.email, 
                role: session.user.role,
                tenantId: session.user.tenantId,
                tenantSlug: session.user.tenant?.slug 
              },
              JWT_SECRET,
              { expiresIn: '1d' }
            );

            // Set new access token cookie
            res.cookie('accessToken', newAccessToken, {
              httpOnly: true,
              secure: process.env.NODE_ENV === 'production',
              sameSite: 'strict',
              maxAge: 24 * 60 * 60 * 1000,
            });

            return res.json({ 
              authenticated: true, 
              user: {
                userId: session.user.id,
                email: session.user.email,
                role: session.user.role,
                tenantId: session.user.tenantId,
                tenantSlug: session.user.tenant?.slug,
              }
            });
          }
        }
      } catch (error) {
        // Refresh token is invalid
      }
    }

    res.json({ authenticated: false });
  } catch (error) {
    console.error('Auth check error:', error);
    res.json({ authenticated: false });
  }
});

// Get current user info
authRoutes.get("/me", authenticateToken, async (req: any, res) => {
  try {
    const user = await db.query.users.findFirst({
      where: sql`${users.id} = ${req.user.userId}`,
      with: {
        tenant: true,
      },
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      tenantId: user.tenantId,
      tenantSlug: user.tenant?.slug,
      emailVerified: user.emailVerified,
      twoFactorEnabled: user.twoFactorEnabled,
      theme: user.theme,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt,
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ message: 'Failed to get user info' });
  }
});

// Debug token endpoint
authRoutes.get("/debug-token", authenticateToken, async (req: any, res) => {
  try {
    res.json({
      message: 'Token is valid',
      user: req.user,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Debug token error:', error);
    res.status(500).json({ message: 'Token debug failed' });
  }
});

// Restore session endpoint
authRoutes.post("/restore-session", async (req, res) => {
  try {
    const { refreshToken } = req.cookies;

    if (!refreshToken) {
      return res.status(401).json({ message: 'Refresh token required' });
    }

    // Verify refresh token
    const decoded = jwt.verify(refreshToken, REFRESH_TOKEN_SECRET) as any;
    
    if (decoded.type !== 'refresh') {
      return res.status(401).json({ message: 'Invalid refresh token' });
    }

    // Find session
    const session = await db.query.refreshTokens.findFirst({
      where: sql`${refreshTokens.token} = ${refreshToken}`,
      with: {
        user: {
          with: {
            tenant: true,
          },
        },
      },
    });

    if (!session || session.expiresAt < new Date()) {
      return res.status(401).json({ message: 'Invalid or expired session' });
    }

    // Generate new access token
    const accessToken = jwt.sign(
      { 
        userId: session.user.id, 
        email: session.user.email, 
        role: session.user.role,
        tenantId: session.user.tenantId,
        tenantSlug: session.user.tenant?.slug 
      },
      JWT_SECRET,
      { expiresIn: '1d' }
    );

    // Set new access token cookie
    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000,
    });

    res.json({
      message: 'Session restored successfully',
      user: {
        id: session.user.id,
        email: session.user.email,
        firstName: session.user.firstName,
        lastName: session.user.lastName,
        role: session.user.role,
        tenantId: session.user.tenantId,
        tenantSlug: session.user.tenant?.slug,
        emailVerified: session.user.emailVerified,
        twoFactorEnabled: session.user.twoFactorEnabled,
        theme: session.user.theme,
        avatarUrl: session.user.avatarUrl,
      },
      accessToken,
    });
  } catch (error) {
    console.error('Session restore error:', error);
    res.status(401).json({ message: 'Session restore failed' });
  }
});

// Get refresh token info
authRoutes.get("/refresh-token-info", async (req, res) => {
  try {
    const { refreshToken } = req.cookies;

    if (!refreshToken) {
      return res.json({ hasRefreshToken: false });
    }

    try {
      const decoded = jwt.verify(refreshToken, REFRESH_TOKEN_SECRET) as any;
      const session = await db.query.refreshTokens.findFirst({
        where: sql`${refreshTokens.token} = ${refreshToken}`,
      });

      if (session && session.expiresAt > new Date()) {
        return res.json({
          hasRefreshToken: true,
          valid: true,
          expiresAt: session.expiresAt,
          userId: decoded.userId,
        });
      } else {
        return res.json({
          hasRefreshToken: true,
          valid: false,
          reason: 'expired',
        });
      }
    } catch (error) {
      return res.json({
        hasRefreshToken: true,
        valid: false,
        reason: 'invalid',
      });
    }
  } catch (error) {
    console.error('Refresh token info error:', error);
    res.status(500).json({ message: 'Failed to get refresh token info' });
  }
});

// Update user profile
authRoutes.put("/profile", authenticateToken, async (req: any, res) => {
  try {
    const validatedData = updateProfileSchema.parse(req.body);
    const { firstName, lastName } = validatedData;

    const sanitizedFirstName = sanitizeName(firstName);
    const sanitizedLastName = sanitizeName(lastName);

    await db.update(users)
      .set({
        firstName: sanitizedFirstName,
        lastName: sanitizedLastName,
        updatedAt: new Date(),
      })
      .where(sql`${users.id} = ${req.user.userId}`);

    res.json({ message: 'Profile updated successfully' });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ message: 'Profile update failed' });
  }
});

// Upload avatar
authRoutes.post("/avatar", authenticateToken, (req: any, res) => {
  avatarUpload.single('avatar')(req, res, async (err) => {
    if (err) {
      return handleUploadError(err, res);
    }

    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    try {
      // Process image with Sharp
      const processedBuffer = await sharp(req.file.buffer)
        .resize(200, 200, { fit: 'cover' })
        .jpeg({ quality: 90 })
        .toBuffer();

      // Generate unique filename
      const filename = `avatars/${req.user.userId}-${Date.now()}.jpg`;

      // Upload to R2
      const uploadResult = await uploadToR2(processedBuffer, filename, 'image/jpeg');

      if (!uploadResult.success) {
        return res.status(500).json({ message: 'Failed to upload avatar' });
      }

      // Update user avatar URL
      await db.update(users)
        .set({
          avatarUrl: uploadResult.url,
          updatedAt: new Date(),
        })
        .where(sql`${users.id} = ${req.user.userId}`);

      res.json({
        message: 'Avatar uploaded successfully',
        avatarUrl: uploadResult.url,
      });
    } catch (error) {
      console.error('Avatar upload error:', error);
      res.status(500).json({ message: 'Avatar upload failed' });
    }
  });
});

// Delete avatar
authRoutes.delete("/avatar", authenticateToken, async (req: any, res) => {
  try {
    const user = await db.query.users.findFirst({
      where: sql`${users.id} = ${req.user.userId}`,
    });

    if (!user || !user.avatarUrl) {
      return res.status(404).json({ message: 'No avatar found' });
    }

    // Extract filename from URL
    const urlParts = user.avatarUrl.split('/');
    const filename = urlParts[urlParts.length - 1];

    // Delete from R2
    await deleteFromR2(`avatars/${filename}`);

    // Update user
    await db.update(users)
      .set({
        avatarUrl: null,
        updatedAt: new Date(),
      })
      .where(sql`${users.id} = ${req.user.userId}`);

    res.json({ message: 'Avatar deleted successfully' });
  } catch (error) {
    console.error('Avatar deletion error:', error);
    res.status(500).json({ message: 'Avatar deletion failed' });
  }
});

// 2FA setup
authRoutes.post("/2fa/setup", authenticateToken, async (req: any, res) => {
  try {
    const user = await db.query.users.findFirst({
      where: sql`${users.id} = ${req.user.userId}`,
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.twoFactorEnabled) {
      return res.status(400).json({ message: '2FA is already enabled' });
    }

    // Generate secret
    const secret = authenticator.generateSecret();
    const otpauthUrl = authenticator.keyuri(
      user.email,
      'Authentik',
      secret
    );

    // Generate QR code
    const qrCodeUrl = await QRCode.toDataURL(otpauthUrl);

    // Store secret temporarily (you might want to store this in a secure way)
    await db.update(users)
      .set({
        twoFactorSecret: secret,
        updatedAt: new Date(),
      })
      .where(sql`${users.id} = ${req.user.userId}`);

    res.json({
      secret,
      qrCodeUrl,
      message: '2FA setup initiated. Scan the QR code with your authenticator app.',
    });
  } catch (error) {
    console.error('2FA setup error:', error);
    res.status(500).json({ message: '2FA setup failed' });
  }
});

// Enable 2FA
authRoutes.post("/2fa/enable", authenticateToken, async (req: any, res) => {
  try {
    const validatedData = enable2FASchema.parse(req.body);
    const { token } = validatedData;

    const user = await db.query.users.findFirst({
      where: sql`${users.id} = ${req.user.userId}`,
    });

    if (!user || !user.twoFactorSecret) {
      return res.status(400).json({ message: '2FA setup not initiated' });
    }

    // Verify token
    const isValid = authenticator.verify({
      token,
      secret: user.twoFactorSecret,
    });

    if (!isValid) {
      return res.status(400).json({ message: 'Invalid 2FA token' });
    }

    // Enable 2FA
    await db.update(users)
      .set({
        twoFactorEnabled: true,
        twoFactorSecret: null, // Clear the secret after enabling
        updatedAt: new Date(),
      })
      .where(sql`${users.id} = ${req.user.userId}`);

    res.json({ message: '2FA enabled successfully' });
  } catch (error) {
    console.error('2FA enable error:', error);
    res.status(500).json({ message: '2FA enable failed' });
  }
});

// Delete account
authRoutes.delete("/account", authenticateToken, async (req: any, res) => {
  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ message: 'Password required' });
    }

    const user = await db.query.users.findFirst({
      where: sql`${users.id} = ${req.user.userId}`,
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ message: 'Invalid password' });
    }

    // Delete user (this will cascade to related records)
    await db.delete(users)
      .where(sql`${users.id} = ${req.user.userId}`);

    // Clear cookies
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');

    res.json({ message: 'Account deleted successfully' });
  } catch (error) {
    console.error('Account deletion error:', error);
    res.status(500).json({ message: 'Account deletion failed' });
  }
});

// Forgot password
authRoutes.post("/forgot-password", async (req, res) => {
  try {
    const validatedData = forgotPasswordSchema.parse(req.body);
    const { email } = validatedData;

    const sanitizedEmail = sanitizeEmail(email);

    // Check rate limiting
    const clientIP = getClientIP(req);
    if (!(await checkRateLimit(`forgot-password:${clientIP}`, 3, 15 * 60 * 1000))) {
      return res.status(429).json({ message: 'Too many password reset requests' });
    }

    const user = await db.query.users.findFirst({
      where: sql`${users.email} = ${sanitizedEmail}`,
    });

    if (!user) {
      // Don't reveal if user exists or not
      return res.json({ message: 'If the email exists, a password reset link has been sent' });
    }

    // Generate reset token
    const resetToken = randomUUID();
    const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await db.update(users)
      .set({
        resetToken,
        resetExpires,
        updatedAt: new Date(),
      })
      .where(sql`${users.id} = ${user.id}`);

    // Send reset email
    try {
      await emailService.sendPasswordResetEmail(sanitizedEmail, resetToken);
    } catch (emailError) {
      console.error('Failed to send password reset email:', emailError);
      return res.status(500).json({ message: 'Failed to send password reset email' });
    }

    res.json({ message: 'If the email exists, a password reset link has been sent' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ message: 'Password reset request failed' });
  }
});

// Get user sessions
authRoutes.get("/sessions", authenticateToken, async (req: any, res) => {
  try {
    const sessions = await db.query.refreshTokens.findMany({
      where: sql`${refreshTokens.userId} = ${req.user.userId}`,
      orderBy: sql`${refreshTokens.createdAt} DESC`,
    });

    res.json(sessions.map(session => ({
      id: session.id,
      deviceId: session.deviceId,
      deviceName: session.deviceName,
      userAgent: session.userAgent,
      ipAddress: session.ipAddress,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
      isCurrent: session.token === req.cookies.refreshToken,
    })));
  } catch (error) {
    console.error('Get sessions error:', error);
    res.status(500).json({ message: 'Failed to get sessions' });
  }
});

// Delete specific session
authRoutes.delete("/sessions", authenticateToken, async (req: any, res) => {
  try {
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({ message: 'Session ID required' });
    }

    // Verify session belongs to user
    const session = await db.query.refreshTokens.findFirst({
      where: sql`${refreshTokens.id} = ${sessionId} AND ${refreshTokens.userId} = ${req.user.userId}`,
    });

    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    // Delete session
    await db.delete(refreshTokens)
      .where(sql`${refreshTokens.id} = ${sessionId}`);

    res.json({ message: 'Session deleted successfully' });
  } catch (error) {
    console.error('Delete session error:', error);
    res.status(500).json({ message: 'Failed to delete session' });
  }
});

// Logout all sessions
authRoutes.post("/logout-all", authenticateToken, async (req: any, res) => {
  try {
    // Delete all sessions for user except current one
    await db.delete(refreshTokens)
      .where(sql`${refreshTokens.userId} = ${req.user.userId} AND ${refreshTokens.token} != ${req.cookies.refreshToken || ''}`);

    res.json({ message: 'All other sessions logged out successfully' });
  } catch (error) {
    console.error('Logout all error:', error);
    res.status(500).json({ message: 'Failed to logout all sessions' });
  }
});

// Update theme
authRoutes.patch("/theme", authenticateToken, async (req: any, res) => {
  try {
    const { theme } = req.body;

    if (!theme || !['light', 'dark', 'system'].includes(theme)) {
      return res.status(400).json({ message: 'Invalid theme' });
    }

    await db.update(users)
      .set({
        theme,
        updatedAt: new Date(),
      })
      .where(sql`${users.id} = ${req.user.userId}`);

    res.json({ message: 'Theme updated successfully' });
  } catch (error) {
    console.error('Theme update error:', error);
    res.status(500).json({ message: 'Theme update failed' });
  }
});

export { authenticateToken, requireRole };