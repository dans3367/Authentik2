# Security Features Documentation

This document outlines the security features implemented in the Authentik backend.

## Overview

The application implements multiple layers of security to protect against common web vulnerabilities:

1. **SQL Injection Protection** - Using Drizzle ORM with parameterized queries
2. **XSS Prevention** - Input sanitization and output encoding
3. **Rate Limiting** - Protecting against brute force and DoS attacks
4. **Security Headers** - Helmet.js for comprehensive security headers
5. **Input Validation** - Express-validator for request validation
6. **Password Security** - Strong password requirements and bcrypt hashing

## Security Middleware Stack

### 1. Helmet.js Configuration
Located in `server/middleware/security.ts`

- Content Security Policy (CSP)
- X-Frame-Options: DENY (prevent clickjacking)
- X-Content-Type-Options: nosniff
- Strict-Transport-Security (HSTS)
- X-XSS-Protection

### 2. Rate Limiting

Three levels of rate limiting are configured:

- **General Rate Limiter**: 1000 requests per 15 minutes per IP (relaxed for debugging)
- **Authentication Rate Limiter**: 50 failed attempts per 15 minutes (relaxed for debugging)
- **API Rate Limiter**: 300 requests per minute (relaxed for debugging)

**For Development/Debugging:**
- Set `DISABLE_RATE_LIMITING=true` in your `.env` file to completely disable rate limiting
- Current limits are 10x higher than production recommendations

### 3. Input Sanitization

All user inputs are sanitized to prevent XSS attacks:

```typescript
// Automatic sanitization applied to:
- req.body
- req.query
- req.params
```

The sanitization removes:
- Script tags
- Event handlers (onclick, onerror, etc.)
- JavaScript protocols

### 4. SQL Injection Protection

- **Drizzle ORM**: All database queries use parameterized queries
- **Additional escaping**: Helper function `escapeSQL()` for extra protection
- **MongoDB sanitization**: Prevents NoSQL injection attacks

### 5. Password Security

Password requirements enforced:
- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character
- Not in common passwords list
- Hashed with bcrypt (12 rounds)

### 6. Validation Middleware

Located in `server/middleware/validation.ts`

Common validators for:
- Email validation and normalization
- Password strength
- UUID validation
- Name validation (alphanumeric + special chars)
- Slug validation
- Pagination parameters

## Security Configuration

The main security configuration is in `server/config/security.ts`:

```typescript
{
  rateLimits: { /* rate limit configurations */ },
  cors: { /* CORS settings */ },
  session: { /* session security */ },
  jwt: { /* JWT token expiry */ },
  passwordPolicy: { /* password requirements */ },
  headers: { /* security headers */ },
  fileUpload: { /* file upload restrictions */ },
  ipRestrictions: { /* IP whitelist/blacklist */ },
  csp: { /* Content Security Policy */ }
}
```

## Usage Examples

### Protected Route with Validation

```typescript
app.post("/api/users", 
  authRateLimiter,
  createUserValidation,
  handleValidationErrors,
  async (req, res) => {
    // Route handler
  }
);
```

### Password Validation

```typescript
const { valid, errors } = validatePasswordStrength(password);
if (!valid) {
  return res.status(400).json({ errors });
}
```

### Custom Rate Limiter

```typescript
const customLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10, // 10 requests
  message: "Custom rate limit message"
});
```

## Security Audit Logging

All security events are logged:
- Authentication failures
- Rate limit violations
- Suspicious activities (403/4xx responses)

## Testing Security

Run the security test script:

```bash
npx tsx server/test-security.ts
```

This tests:
- Password strength validation
- Input sanitization
- SQL injection protection

## Best Practices

1. Always use parameterized queries (Drizzle ORM handles this)
2. Apply appropriate rate limiters to sensitive endpoints
3. Validate and sanitize all user inputs
4. Use the validation middleware for consistent validation
5. Keep security dependencies updated
6. Monitor security audit logs
7. Use environment variables for secrets
8. Enable HTTPS in production

## Environment Variables

Required security-related environment variables:

```
JWT_SECRET=your-super-secret-jwt-key
REFRESH_TOKEN_SECRET=your-super-secret-refresh-key
SESSION_SECRET=your-super-secret-session-key
DATABASE_URL=your-database-connection-string
```

## Compliance

The security implementation helps meet common compliance requirements:
- OWASP Top 10 protection
- PCI DSS (for payment processing)
- GDPR (data protection)