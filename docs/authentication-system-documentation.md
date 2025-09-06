# Authentik Authentication System with Better Auth Documentation

## Overview

Authentik implements a robust, multi-tenant authentication system using Better Auth, a modern authentication library that provides secure JWT token management with automatic refresh capabilities, device tracking, and comprehensive session management. The system is built with TypeScript across both frontend (React/Redux) and backend (Express.js) components.

## Architecture Components

### Frontend Architecture
- **React with Redux Toolkit**: State management for authentication
- **AuthManager Class**: Centralized authentication service
- **Automatic Token Refresh**: Background token renewal system
- **Local Storage**: Persistent token storage
- **Event System**: Auth state change notifications

### Backend Architecture
- **Better Auth Integration**: Secure authentication with automatic JWT management
- **Express.js Middleware**: Better-auth handlers for authentication endpoints
- **PostgreSQL + Drizzle ORM**: Session and user data persistence
- **Device Tracking**: Unique device identification and management via Better Auth
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
- **`server/auth.ts`** - Better Auth configuration and setup
  - Better Auth instance with database adapter
  - Email and password authentication configuration
  - Email verification settings
  - Social provider configuration
  - Security and trusted origins settings

#### Better Auth Integration
Better Auth automatically provides the following authentication endpoints:
- `POST /api/auth/sign-in` - User sign in
- `POST /api/auth/sign-up` - User registration
- `POST /api/auth/sign-out` - User logout
- `GET /api/auth/session` - Get current session
- `POST /api/auth/refresh` - Refresh tokens (automatic)
- `POST /api/auth/reset-password` - Password reset
- `POST /api/auth/verify-email` - Email verification

#### Data Persistence
- **`server/storage.ts`** - Database operations for user management
  - User CRUD operations
  - Multi-tenant user lookup functions
  - Device tracking data storage (legacy support)

#### Key Storage Functions:
```typescript
// User management functions
findUserByEmailAcrossTenants(email) - Multi-tenant user lookup
getTenantOwner(tenantId) - Get tenant owner information
getUser(userId, tenantId) - Get user by ID with tenant context
createUser(userData) - Create new user
updateUser(userId, updates) - Update user information
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

## Better Auth Token System

### Token Management

Better Auth automatically manages JWT tokens with secure defaults:

#### Access Tokens
- **Purpose**: Short-lived authentication token for API requests
- **Lifetime**: 1 hour (better-auth default)
- **Storage**: Secure HTTP-only cookies or localStorage
- **Automatic Refresh**: Handled transparently by Better Auth client

#### Refresh Tokens
- **Purpose**: Long-lived token for obtaining new access tokens
- **Lifetime**: 7 days (better-auth default)
- **Storage**: Secure HTTP-only cookies
- **Automatic Rotation**: New refresh tokens issued on each refresh

### Better Auth Configuration

```typescript
// server/auth.ts
const authInstance = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: betterAuthUser,
      session: betterAuthSession,
      account: betterAuthAccount,
      verification: betterAuthVerification,
    },
  }),
  emailAndPassword: {
    enabled: true,
  },
  emailVerification: {
    sendOnSignUp: true,
  },
  baseURL: process.env.BASE_URL || "http://localhost:5000",
  secret: process.env.BETTER_AUTH_SECRET,
  trustedOrigins: ["http://localhost:5000", "http://localhost:5173"],
});
```

### Automatic Token Handling

Better Auth provides automatic token management:

1. **Token Generation**: Automatic JWT creation with secure signing
2. **Token Validation**: Built-in middleware for protected routes
3. **Token Refresh**: Automatic background refresh before expiration
4. **Session Management**: Secure session storage and cleanup
5. **Security Headers**: Automatic security headers for authentication

## Authentication Flow

### 1. Login Process

#### Frontend (Better Auth Client)
```typescript
// Using Better Auth client hooks
import { useSession, signIn } from "@/lib/betterAuthClient";

const LoginComponent = () => {
  const signInMutation = signIn();

  const handleLogin = async (credentials) => {
    try {
      await signInMutation.mutateAsync({
        email: credentials.email,
        password: credentials.password,
      });
      // Better Auth automatically handles token storage and session management
    } catch (error) {
      console.error("Login failed:", error);
    }
  };

  return (
    <form onSubmit={handleLogin}>
      {/* Login form */}
    </form>
  );
};
```

#### Backend (Better Auth)
```typescript
// server/auth.ts - Better Auth handles login automatically
const authInstance = betterAuth({
  // Configuration as shown above
  // Better Auth automatically:
  // 1. Validates credentials
  // 2. Generates secure JWT tokens
  // 3. Manages session storage
  // 4. Handles rate limiting
  // 5. Sets secure cookies
});

// In server/index.ts
app.all("/api/auth/*", toNodeHandler(auth));
// This single line handles all authentication endpoints
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

#### Better Auth Automatic Token Management

Better Auth handles token refresh automatically with no manual implementation required:

```typescript
// client/src/lib/betterAuthClient.ts
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_BETTER_AUTH_URL,
  // Better Auth automatically:
  // - Refreshes tokens before expiration
  // - Handles token storage securely
  // - Manages session state
  // - Provides automatic retry on 401 responses
});

export const { useSession, signIn, signOut, signUp } = authClient;
```

#### Automatic Refresh Features
- **Transparent Operation**: Token refresh happens automatically in the background
- **Smart Timing**: Refreshes tokens before they expire to prevent interruptions
- **Error Handling**: Automatic retry logic for network issues
- **Session Persistence**: Maintains user session across browser refreshes
- **Security**: Uses secure HTTP-only cookies for refresh tokens

#### Usage in Components
```typescript
const MyComponent = () => {
  const { data: session, isLoading } = useSession();

  // Better Auth automatically handles:
  // - Token refresh before expiration
  // - Session validation
  // - Secure token storage
  // - Authentication state management

  if (isLoading) return <div>Loading...</div>;
  if (!session) return <div>Please sign in</div>;

  return <div>Welcome {session.user.email}!</div>;
};
```

## Session and Device Management

### Better Auth Session Management

Better Auth provides built-in session management with device tracking:

#### Automatic Session Tracking
- **Device Fingerprinting**: Automatic device identification and tracking
- **Session Storage**: Secure session storage in database with device information
- **Session Cleanup**: Automatic cleanup of expired and inactive sessions
- **Multi-device Support**: Support for multiple concurrent sessions per user

#### Session Configuration
```typescript
// server/services/sessionCleanup.ts
export const defaultSessionConfig: SessionCleanupConfig = {
  cleanupIntervalMinutes: 60,      // Run cleanup every hour
  maxSessionsPerUser: 10,          // Maximum 10 active sessions per user
  inactivityTimeoutDays: 30,       // Clean sessions inactive for 30 days
  cleanExpiredTokens: true,        // Remove expired sessions
  cleanInactiveSessions: true,     // Remove inactive sessions
  enforceSessionLimits: true,      // Enforce per-user limits
  enableCleanupLogs: true,         // Enable cleanup logging
};
```

#### Session Statistics and Monitoring
```typescript
// Get comprehensive session statistics
const sessionStats = await sessionCleanupService.getSessionStats();
// Returns: totalActiveSessions, expiredSessions, inactiveSessions, sessionsByTenant
```

#### Administrative Session Management
```typescript
// Admin endpoints for session management
GET /api/admin/sessions/stats        // Session statistics
GET /api/admin/sessions              // List all sessions
POST /api/admin/sessions/cleanup     // Manual cleanup
DELETE /api/admin/sessions           // Bulk session deletion
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

### Better Auth Authentication Endpoints
- `POST /api/auth/sign-in` - User sign in with email/password
- `POST /api/auth/sign-up` - User registration
- `POST /api/auth/sign-out` - User logout
- `GET /api/auth/session` - Get current session information
- `POST /api/auth/refresh` - Automatic token refresh (handled by Better Auth)
- `POST /api/auth/reset-password` - Password reset request
- `POST /api/auth/verify-email` - Email verification

### User Management Endpoints
- `PUT /api/users/profile` - Update user profile
- `PUT /api/users/change-password` - Change password
- `DELETE /api/users/account` - Delete user account

### Administrative Endpoints
- `GET /api/admin/sessions/stats` - Session statistics and monitoring
- `GET /api/admin/sessions` - List all user sessions
- `POST /api/admin/sessions/cleanup` - Manual session cleanup
- `DELETE /api/admin/sessions` - Bulk session deletion

### Additional Endpoints
- `GET /api/health` - Health check endpoint
- `GET /api/docs` - API documentation

## Configuration

### Environment Variables
```bash
# Better Auth Configuration
BETTER_AUTH_SECRET=your-super-secret-better-auth-key
BASE_URL=http://localhost:5000

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/authentik

# Email Service
RESEND_API_KEY=your-resend-api-key

# Client Configuration
VITE_BETTER_AUTH_URL=http://localhost:5000
VITE_STRIPE_PUBLIC_KEY=pk_test_your_stripe_public_key_here

# Avatar Storage (Optional)
R2_ACCESS_KEY_ID=your-r2-access-key
R2_SECRET_ACCESS_KEY=your-r2-secret-key
R2_BUCKET_NAME=authentik-avatars
R2_ENDPOINT=your-r2-endpoint
R2_PUBLIC_URL=your-r2-public-url
```

### Security Best Practices
1. **Use strong, unique secrets** for Better Auth signing
2. **Enable HTTPS in production** for secure cookie transmission
3. **Configure trusted origins** properly for CORS security
4. **Monitor session activity** for suspicious behavior
5. **Regular session cleanup** to maintain database performance
6. **Use environment-specific configurations**

## Troubleshooting

### Common Issues
1. **Session Not Found**: Check Better Auth session storage
2. **Authentication Failures**: Verify Better Auth configuration and database connection
3. **CORS Errors**: Ensure trusted origins are properly configured
4. **Session Cleanup**: Monitor session cleanup service logs

### Debugging Tools
- **Console Logging**: Better Auth client logging for authentication flows
- **Network Tab**: Monitor Better Auth API requests
- **Browser DevTools**: Inspect Better Auth session data
- **Database Queries**: Check Better Auth session and user tables
- **Session Cleanup Logs**: Monitor automatic session cleanup operations

This documentation provides a comprehensive overview of the Authentik authentication system using Better Auth, including implementation details, configuration, and operational procedures. 