# Authentik Authentication and JWT Management System Documentation

## Overview

Authentik implements a robust, multi-tenant authentication system using JWT tokens with automatic refresh capabilities, device tracking, and comprehensive session management. The system is built with TypeScript across both frontend (React/Redux) and backend (Express.js) components.

## Architecture Components

### Frontend Architecture
- **React with Redux Toolkit**: State management for authentication
- **AuthManager Class**: Centralized authentication service
- **Automatic Token Refresh**: Background token renewal system
- **Local Storage**: Persistent token storage
- **Event System**: Auth state change notifications

### Backend Architecture
- **Express.js Middleware**: JWT validation and user authentication
- **PostgreSQL + Drizzle ORM**: Session and user data persistence
- **Device Tracking**: Unique device identification and management
- **Rate Limiting**: Protection against brute force attacks
- **Multi-tenant Support**: Isolated authentication per tenant

## File Structure and Responsibilities

### Frontend Files

#### Core Authentication Files
- **`client/src/lib/auth.ts`** - Main authentication manager class
  - `AuthManager` class with token management
  - Automatic token refresh scheduling and execution
  - Local storage management for access tokens
  - Authentication state event system
  - API request handling with automatic token refresh

- **`client/src/store/authSlice.ts`** - Redux state management
  - Authentication state definition (`AuthState` interface)
  - Async thunks for login, logout, and auth status checking
  - Redux reducers for auth state updates
  - Integration with AuthManager for token storage

#### Authentication Hooks
- **`client/src/hooks/useAuth.ts`** - Primary authentication hook
  - `useLogin()` hook for login functionality
  - Integration with subscription checking
  - Error handling and user notifications
  - Automatic refresh system initialization

- **`client/src/hooks/useReduxAuth.ts`** - Redux-specific auth hooks
  - `useReduxLogin()` hook for Redux-based login
  - Direct Redux dispatch for auth actions
  - Simplified interface for components

#### UI Components
- **`client/src/pages/auth.tsx`** - Login/register page
  - Login form handling and validation
  - 2FA token input and processing
  - Navigation between auth views (login/register/forgot)

- **`client/src/components/AppLayout.tsx`** - Main layout with auth checks
  - Authentication state monitoring
  - Conditional rendering based on auth status

### Backend Files

#### Core Authentication Logic
- **`server/routes.ts`** - Main authentication endpoints and middleware
  - `authenticateToken` middleware for JWT validation
  - `generateTokens()` function for JWT creation
  - `getDeviceInfo()` function for device fingerprinting
  - All authentication endpoints (`/api/auth/*`)
  - Token configuration constants (`ACCESS_TOKEN_EXPIRES`, `REFRESH_TOKEN_EXPIRES`)

#### Key Authentication Endpoints in `server/routes.ts`:
```typescript
Lines 94-153:   authenticateToken middleware
Lines 175-186:  generateTokens function
Lines 457-590:  POST /api/auth/login endpoint
Lines 794-909:  POST /api/auth/refresh endpoint
Lines 910-959:  POST /api/auth/logout endpoint
Lines 996-1013: GET /api/auth/me endpoint
Lines 962-991:  GET /api/auth/check endpoint
Lines 1550-1578: GET /api/auth/sessions endpoint
```

#### Data Persistence
- **`server/storage.ts`** - Database operations for authentication
  - `IStorage` interface defining auth operations
  - Refresh token CRUD operations
  - User session management
  - Device tracking data storage
  - Multi-tenant user lookup functions

#### Key Storage Functions:
```typescript
Lines 89-94:   createRefreshToken, getRefreshToken, deleteRefreshToken
Lines 96-100:  getUserSessions, updateSessionLastUsed, deleteSession
Lines 71-72:   findUserByEmailAcrossTenants (for login)
Lines 68-69:   getTenantOwner (for tenant context)
```

#### Security and Validation
- **`server/middleware/security.ts`** - Rate limiting and security middleware
  - `authRateLimiter` for login attempt protection
  - General API rate limiting

- **`server/utils/sanitization.ts`** - Input validation and rate limiting
  - Input sanitization functions (`sanitizeEmail`, `sanitizePassword`)
  - Rate limiting implementation (`checkRateLimit`, `clearRateLimit`)
  - IP address extraction (`getClientIP`)

#### Database Schema
- **`shared/schema.ts`** - Database schema definitions
  - `users` table schema with authentication fields
  - `refreshTokens` table schema for session management
  - `sessions` table for device tracking
  - Type definitions for authentication data structures

### Configuration Files

#### Environment and Security
- **`server/config/security.ts`** - Security configuration
  - CORS settings for authentication endpoints
  - Security headers and policies

- **`.env`** - Environment variables
  - `JWT_SECRET` - Access token signing secret
  - `REFRESH_TOKEN_SECRET` - Refresh token signing secret
  - `DATABASE_URL` - Database connection string

### Request/Response Flow by File

#### Login Flow
1. **Frontend Request**: `auth.tsx` → `useReduxAuth.ts` → `authSlice.ts`
2. **API Call**: `authSlice.ts` → `POST /api/auth/login`
3. **Backend Processing**: `routes.ts` (login endpoint) → `storage.ts` (user lookup)
4. **Token Generation**: `routes.ts` (`generateTokens` function)
5. **Session Storage**: `routes.ts` → `storage.ts` (`createRefreshToken`)
6. **Frontend Update**: Response → `authSlice.ts` → `auth.ts` (`setAccessToken`)

#### Token Refresh Flow
1. **Automatic Trigger**: `auth.ts` (`scheduleTokenRefresh`)
2. **API Call**: `auth.ts` → `POST /api/auth/refresh`
3. **Backend Processing**: `routes.ts` (refresh endpoint) → `storage.ts` (token validation)
4. **New Token Generation**: `routes.ts` (`generateTokens`)
5. **Token Rotation**: `routes.ts` → `storage.ts` (delete old, create new)
6. **Frontend Update**: Response → `auth.ts` (`setAccessToken`)

#### Protected Route Access
1. **Frontend Request**: `auth.ts` (`makeAuthenticatedRequest`)
2. **Token Validation**: `routes.ts` (`authenticateToken` middleware)
3. **User Lookup**: `authenticateToken` → `storage.ts` (`getUser`)
4. **Request Processing**: Authenticated route handler
5. **Auto-refresh on 401**: `auth.ts` (`refreshAccessToken`) if token expired

This file organization ensures clear separation of concerns with authentication logic distributed across specialized modules for maintainability and security.

## JWT Token System

### Token Types and Configuration

```typescript
// Token Configuration
const ACCESS_TOKEN_EXPIRES = "15m";    // 15 minutes
const REFRESH_TOKEN_EXPIRES = "7d";    // 7 days (or 30 days with "Remember Me")
```

#### Access Token
- **Purpose**: Short-lived authentication token for API requests
- **Lifetime**: 15 minutes
- **Storage**: localStorage on frontend
- **Payload**: `{ userId, tenantId, exp, iat }`
- **Usage**: Bearer token in Authorization header

#### Refresh Token
- **Purpose**: Long-lived token for obtaining new access tokens
- **Lifetime**: 7 days (default) or 30 days (with "Remember Me")
- **Storage**: httpOnly cookie (secure, sameSite: lax)
- **Payload**: `{ userId, tenantId, tokenId, exp, iat }`
- **Usage**: Automatic refresh via `/api/auth/refresh` endpoint

### Token Generation

```typescript
const generateTokens = (userId: string, tenantId: string) => {
  const accessToken = jwt.sign({ userId, tenantId }, JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRES,
  });
  const refreshToken = jwt.sign(
    { userId, tenantId, tokenId: randomBytes(16).toString("hex") },
    REFRESH_TOKEN_SECRET,
    { expiresIn: REFRESH_TOKEN_EXPIRES },
  );
  return { accessToken, refreshToken };
};
```

### Token Validation Middleware

The `authenticateToken` middleware validates access tokens on protected routes:

1. **Extract Token**: From `Authorization: Bearer <token>` header
2. **Verify Signature**: Using JWT_SECRET
3. **Check User**: Validate user exists and is active
4. **Attach User**: Add user data to `req.user` for downstream handlers

```typescript
const authenticateToken = async (req: any, res: any, next: any) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "Access token required" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    const user = await storage.getUser(decoded.userId, decoded.tenantId);
    
    if (!user || !user.isActive) {
      return res.status(401).json({ message: "User not found or inactive" });
    }

    req.user = { ...user }; // Attach full user data
    next();
  } catch (error) {
    // Handle TokenExpiredError, JsonWebTokenError, etc.
    return res.status(401).json({ message: "Invalid access token" });
  }
};
```

## Authentication Flow

### 1. Login Process

#### Frontend (Redux)
```typescript
// 1. User submits credentials
const loginUser = createAsyncThunk("auth/login", async (credentials) => {
  const response = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include", // Include cookies
    body: JSON.stringify(credentials),
  });
  
  const data = await response.json();
  
  // Handle 2FA requirement
  if (data.requires2FA) {
    return rejectWithValue("2FA_REQUIRED");
  }
  
  return {
    user: data.user,
    accessToken: data.accessToken,
  };
});
```

#### Backend (Express)
```typescript
app.post("/api/auth/login", async (req, res) => {
  // 1. Rate limiting check
  if (!checkRateLimit(clientIP)) {
    return res.status(429).json({ message: "Too many login attempts" });
  }

  // 2. Input validation and sanitization
  const { email, password, twoFactorToken, rememberMe } = loginSchema.parse(req.body);

  // 3. Find user across all tenants
  const userResult = await storage.findUserByEmailAcrossTenants(email);
  
  // 4. Password verification
  const isValidPassword = await bcrypt.compare(password, user.password);
  
  // 5. 2FA verification (if enabled)
  if (user.twoFactorEnabled) {
    const isValid2FA = authenticator.verify({
      token: twoFactorToken,
      secret: user.twoFactorSecret,
    });
  }

  // 6. Generate tokens
  const { accessToken, refreshToken } = generateTokens(user.id, user.tenantId);

  // 7. Store refresh token with device info
  const deviceInfo = getDeviceInfo(req);
  const tokenExpiryDays = rememberMe ? 30 : 7;
  const refreshTokenExpiry = new Date(Date.now() + tokenExpiryDays * 24 * 60 * 60 * 1000);
  
  await storage.createRefreshToken(
    user.id,
    user.tenantId,
    refreshToken,
    refreshTokenExpiry,
    deviceInfo,
  );

  // 8. Set httpOnly cookie
  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: tokenExpiryDays * 24 * 60 * 60 * 1000,
  });

  // 9. Return user data and access token
  res.json({
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
      theme: user.theme || 'light',
      avatarUrl: user.avatarUrl || null,
    },
    emailVerificationRequired: !user.emailVerified,
  });
});
```

### 2. Authentication State Management

#### Redux Store Structure
```typescript
interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isInitialized: boolean;
  error: string | null;
}
```

#### Login Success Handler
```typescript
.addCase(loginUser.fulfilled, (state, action) => {
  state.isLoading = false;
  state.user = action.payload.user;
  state.accessToken = action.payload.accessToken;
  state.isAuthenticated = true;
  state.isInitialized = true;
  state.error = null;
  
  // Store token in AuthManager for automatic refresh
  if (action.payload.accessToken) {
    authManager.setAccessToken(action.payload.accessToken);
  }
})
```

### 3. Automatic Token Refresh System

#### Frontend Implementation
The `AuthManager` class handles automatic token refresh:

```typescript
class AuthManager {
  private scheduleTokenRefresh(token: string): void {
    // Parse token to get expiry time
    const payload = JSON.parse(atob(token.split(".")[1]));
    const expTime = payload.exp * 1000;
    const timeUntilExpiry = expTime - now;

    // Schedule refresh 2 minutes before expiry
    const refreshTime = Math.max(timeUntilExpiry - 120000, 30000);

    this.refreshTimer = setTimeout(async () => {
      try {
        const newToken = await this.refreshAccessToken();
        this.scheduleTokenRefresh(newToken); // Re-schedule with new token
      } catch (error) {
        console.error("Automatic token refresh failed:", error);
        // Only clear tokens on definitive auth failures
        if (error.message.includes("authentication required")) {
          this.clearTokens();
        }
      }
    }, refreshTime);
  }

  async refreshAccessToken(): Promise<string> {
    const response = await fetch("/api/auth/refresh", {
      method: "POST",
      credentials: "include", // Send httpOnly cookie
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        this.clearTokens();
        throw new Error("Token refresh failed - authentication required");
      }
      throw new Error("Token refresh failed - temporary error");
    }

    const data = await response.json();
    this.setAccessToken(data.accessToken);
    return data.accessToken;
  }
}
```

#### Backend Refresh Endpoint
```typescript
app.post("/api/auth/refresh", async (req, res) => {
  // 1. Extract refresh token from httpOnly cookie
  const refreshToken = req.cookies.refreshToken;

  // 2. Verify refresh token signature
  const decoded = jwt.verify(refreshToken, REFRESH_TOKEN_SECRET);

  // 3. Check token exists in database
  const storedToken = await storage.getRefreshToken(refreshToken);
  
  // 4. Validate user is still active
  const user = await storage.getUser(decoded.userId, decoded.tenantId);

  // 5. Update session last used time
  await storage.updateSessionLastUsed(refreshToken);

  // 6. Generate new tokens
  const { accessToken, refreshToken: newRefreshToken } = generateTokens(
    user.id,
    user.tenantId,
  );

  // 7. Replace refresh token in database
  await storage.deleteRefreshToken(refreshToken);
  await storage.createRefreshToken(
    user.id,
    user.tenantId,
    newRefreshToken,
    preservedExpiry,
    preservedDeviceInfo,
  );

  // 8. Set new httpOnly cookie
  res.cookie("refreshToken", newRefreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: cookieMaxAge,
  });

  // 9. Return new access token and user data
  res.json({
    message: "Token refreshed successfully",
    accessToken,
    user: { /* user data */ },
  });
});
```

## Session and Device Management

### Device Identification

Each login creates a unique device session:

```typescript
function getDeviceInfo(req: any) {
  const userAgentString = req.get("User-Agent") || "Unknown";
  const parser = new UAParser(userAgentString);
  const result = parser.getResult();

  // Create unique device fingerprint
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
    ipAddress: req.ip || "Unknown",
  };
}
```

### Session Storage

Refresh tokens are stored with comprehensive device information:

```typescript
interface RefreshToken {
  id: string;
  userId: string;
  tenantId: string;
  token: string;
  expiresAt: Date;
  createdAt: Date;
  lastUsedAt: Date;
  deviceId: string;
  deviceName: string;
  userAgent: string;
  ipAddress: string;
}
```

### Session Management Operations

```typescript
// Get all user sessions
app.get("/api/auth/sessions", authenticateToken, async (req, res) => {
  const sessions = await storage.getUserSessions(req.user.id, req.user.tenantId);
  
  res.json({
    sessions: sessions.map(session => ({
      id: session.id,
      deviceName: session.deviceName,
      ipAddress: session.ipAddress,
      lastUsedAt: session.lastUsedAt,
      createdAt: session.createdAt,
      isCurrent: session.token === req.cookies.refreshToken,
    })),
  });
});

// Delete specific session
app.delete("/api/auth/sessions/:sessionId", authenticateToken, async (req, res) => {
  await storage.deleteSession(req.params.sessionId, req.user.id, req.user.tenantId);
  res.json({ message: "Session deleted successfully" });
});

// Delete all sessions (logout everywhere)
app.delete("/api/auth/sessions", authenticateToken, async (req, res) => {
  await storage.deleteAllUserSessions(req.user.id, req.user.tenantId);
  res.json({ message: "All sessions deleted successfully" });
});
```

## Security Features

### 1. Rate Limiting
- **Login attempts**: IP-based rate limiting to prevent brute force attacks
- **API requests**: General rate limiting on authentication endpoints

### 2. Token Security
- **Access tokens**: Short-lived (15 minutes) to minimize exposure
- **Refresh tokens**: httpOnly cookies prevent XSS attacks
- **Token rotation**: New refresh token issued on each refresh
- **Unique token IDs**: Each refresh token has unique identifier

### 3. Multi-Factor Authentication (2FA)
- **TOTP support**: Time-based one-time passwords using authenticator apps
- **QR code generation**: Easy setup for users
- **Backup codes**: Recovery mechanism (implemented in auth flow)

### 4. Input Sanitization
- **Email validation**: Proper email format and sanitization
- **Password security**: bcrypt hashing with salt
- **SQL injection protection**: Parameterized queries via Drizzle ORM

### 5. Session Security
- **Device tracking**: Monitor and manage login sessions
- **IP address logging**: Track session origins
- **Automatic cleanup**: Expired tokens removed periodically

## Multi-Tenant Architecture

### Tenant-Aware Authentication
- **User lookup**: `findUserByEmailAcrossTenants()` for login
- **Token payload**: Includes `tenantId` for context
- **Data isolation**: All operations scoped to tenant
- **Cross-tenant prevention**: Middleware validates tenant access

### Tenant Context Flow
```typescript
// 1. Login finds user across tenants
const userResult = await storage.findUserByEmailAcrossTenants(email);

// 2. Token includes tenant context
const token = jwt.sign({ userId, tenantId }, JWT_SECRET);

// 3. Middleware validates tenant access
const user = await storage.getUser(decoded.userId, decoded.tenantId);

// 4. All operations scoped to tenant
await storage.createRefreshToken(userId, tenantId, token, expiry, device);
```

## Error Handling and Recovery

### Authentication Errors
- **Token Expired**: Automatic refresh attempt
- **Invalid Token**: Clear tokens and redirect to login
- **Network Errors**: Retry logic with exponential backoff
- **2FA Failures**: Graceful handling with user feedback

### Recovery Mechanisms
- **Token Refresh**: Automatic background refresh
- **Graceful Degradation**: Continue operation with expired tokens when possible
- **Error Logging**: Comprehensive logging for debugging
- **User Notifications**: Clear error messages and recovery instructions

## API Endpoints

### Authentication Endpoints
- `POST /api/auth/login` - User login with credentials
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/logout` - Logout current session
- `GET /api/auth/me` - Get current user info
- `GET /api/auth/check` - Check auth status (refresh token validity)

### Session Management
- `GET /api/auth/sessions` - List user sessions
- `DELETE /api/auth/sessions/:id` - Delete specific session
- `DELETE /api/auth/sessions` - Delete all sessions (logout everywhere)

### User Management
- `PUT /api/auth/profile` - Update user profile
- `PUT /api/auth/change-password` - Change password
- `DELETE /api/auth/account` - Delete user account

### 2FA Management
- `POST /api/auth/2fa/setup` - Initialize 2FA setup
- `POST /api/auth/2fa/enable` - Enable 2FA with verification
- `POST /api/auth/2fa/disable` - Disable 2FA with verification

## Configuration

### Environment Variables
```bash
# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key
REFRESH_TOKEN_SECRET=your-super-secret-refresh-key

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/authentik

# Email Service
RESEND_API_KEY=your-resend-api-key

# Avatar Storage (Optional)
R2_ACCESS_KEY_ID=your-r2-access-key
R2_SECRET_ACCESS_KEY=your-r2-secret-key
R2_BUCKET_NAME=authentik-avatars
R2_ENDPOINT=your-r2-endpoint
R2_PUBLIC_URL=your-r2-public-url
```

### Security Best Practices
1. **Use strong, unique secrets** for JWT signing
2. **Enable HTTPS in production** for secure cookie transmission
3. **Regular token rotation** via automatic refresh
4. **Monitor session activity** for suspicious behavior
5. **Implement proper CORS** policies for API access
6. **Use environment-specific configurations**

## Troubleshooting

### Common Issues
1. **Token Not Found**: Check localStorage and cookie storage
2. **Refresh Failures**: Verify refresh token cookie and database entry
3. **CORS Errors**: Ensure proper credentials handling in requests
4. **Session Cleanup**: Monitor expired token cleanup process

### Debugging Tools
- **Console Logging**: Comprehensive auth flow logging
- **Network Tab**: Monitor token refresh requests
- **Session Storage**: Inspect stored tokens and user data
- **Database Queries**: Check refresh token and user tables

This documentation provides a comprehensive overview of the Authentik authentication system architecture, implementation details, and operational procedures. 