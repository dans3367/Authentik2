import { Router } from 'express';
import { db } from '../db';
import { betterAuthUser } from '@shared/schema';
import { eq } from 'drizzle-orm';
import rateLimit from 'express-rate-limit';

// Extend global type for pendingCompanyNames
declare global {
  var pendingCompanyNames: Record<string, string> | undefined;
}

export const signupRoutes = Router();

// Rate limiter for store-company-name endpoint to prevent abuse
const storeCompanyNameLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 requests per IP per 15 minutes
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

    // Limit total pending entries to prevent memory DoS
    global.pendingCompanyNames = global.pendingCompanyNames || {};
    const pendingCount = Object.keys(global.pendingCompanyNames).length;
    if (pendingCount >= 500) {
      // Evict oldest entries (those closest to expiry) to make room
      const keys = Object.keys(global.pendingCompanyNames);
      const toRemove = keys.slice(0, Math.max(1, Math.floor(keys.length * 0.1)));
      for (const key of toRemove) {
        delete global.pendingCompanyNames[key];
      }
    }

    const normalizedKey = email.toLowerCase();
    global.pendingCompanyNames[normalizedKey] = companyName;

    // Clean up after 5 minutes to prevent memory leaks
    setTimeout(() => {
      if (global.pendingCompanyNames && global.pendingCompanyNames[normalizedKey]) {
        delete global.pendingCompanyNames[normalizedKey];
      }
    }, 5 * 60 * 1000);

    res.json({ message: 'Company name stored successfully' });
  } catch (error) {
    console.error('Store company name error:', error);
    res.status(500).json({ message: 'Failed to store company name' });
  }
});

// Get company name for email (for debugging) - REMOVED for security
// This endpoint was removed because it exposed company names to unauthenticated users

