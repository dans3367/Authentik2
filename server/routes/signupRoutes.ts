import { Router } from 'express';
import crypto from 'crypto';
import { db } from '../db';
import { betterAuthUser } from '@shared/schema';
import { eq } from 'drizzle-orm';
import rateLimit from 'express-rate-limit';
import { sanitizeString } from '../utils/sanitization';

// Extend global type for pendingCompanyNames
declare global {
  var pendingCompanyNames: Map<string, { name: string; expiresAt: number }> | undefined;
}

export const signupRoutes = Router();

// HMAC key for pending company name store — derived from auth secret so
// the raw email is never used as a map key (prevents enumeration if memory
// is ever leaked).  Falls back to a random per-process key.
const PENDING_HMAC_KEY = process.env.BETTER_AUTH_SECRET || crypto.randomBytes(32).toString('hex');

function pendingKey(email: string): string {
  return crypto.createHmac('sha256', PENDING_HMAC_KEY).update(email.toLowerCase()).digest('hex');
}

// Lazy-init + cleanup helper
function getPendingStore(): Map<string, { name: string; expiresAt: number }> {
  if (!global.pendingCompanyNames) {
    global.pendingCompanyNames = new Map();
  }
  // Purge expired entries on each access (cheap at ≤50 entries)
  const now = Date.now();
  for (const [k, v] of global.pendingCompanyNames) {
    if (v.expiresAt <= now) global.pendingCompanyNames.delete(k);
  }
  return global.pendingCompanyNames;
}

// Rate limiter for store-company-name endpoint to prevent abuse
const storeCompanyNameLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per IP per 15 minutes (tightened from 10)
  message: { message: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Store company name for pending signup
// This endpoint is called right before Better Auth signup to store company name
signupRoutes.post("/store-company-name", storeCompanyNameLimiter, async (req, res) => {
  try {
    const { email, companyName } = req.body;

    if (!email || !companyName) {
      return res.status(400).json({ message: 'Email and company name are required' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: 'Invalid email format' });
    }

    // Limit company name length to prevent memory abuse
    if (companyName.length > 200) {
      return res.status(400).json({ message: 'Company name too long' });
    }

    const store = getPendingStore();

    // Reject when store is full instead of evicting (prevents flush attacks)
    if (store.size >= 50) {
      return res.status(503).json({ message: 'Service temporarily busy, please try again in a few minutes' });
    }

    const key = pendingKey(email);
    const sanitizedName = sanitizeString(companyName) || companyName.trim();
    store.set(key, { name: sanitizedName, expiresAt: Date.now() + 5 * 60 * 1000 });

    res.json({ message: 'Company name stored successfully' });
  } catch (error) {
    console.error('Store company name error:', error);
    res.status(500).json({ message: 'Failed to store company name' });
  }
});

// Get company name for email (for debugging) - REMOVED for security
// This endpoint was removed because it exposed company names to unauthenticated users

