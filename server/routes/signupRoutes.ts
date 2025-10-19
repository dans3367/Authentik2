import { Router } from 'express';
import { db } from '../db';
import { betterAuthUser } from '@shared/schema';
import { eq } from 'drizzle-orm';

export const signupRoutes = Router();

// Store company name for pending signup
// This endpoint is called right before Better Auth signup to store company name
signupRoutes.post("/store-company-name", async (req, res) => {
  try {
    const { email, companyName } = req.body;

    if (!email || !companyName) {
      return res.status(400).json({ message: 'Email and company name are required' });
    }

    // Store in a temporary global object (in-memory cache)
    // This is read by the auth hook during user creation
    global.pendingCompanyNames = global.pendingCompanyNames || {};
    global.pendingCompanyNames[email.toLowerCase()] = companyName;

    // Clean up after 5 minutes to prevent memory leaks
    setTimeout(() => {
      if (global.pendingCompanyNames && global.pendingCompanyNames[email.toLowerCase()]) {
        delete global.pendingCompanyNames[email.toLowerCase()];
      }
    }, 5 * 60 * 1000);

    res.json({ message: 'Company name stored successfully' });
  } catch (error) {
    console.error('Store company name error:', error);
    res.status(500).json({ message: 'Failed to store company name' });
  }
});

// Get company name for email (for debugging)
signupRoutes.get("/get-company-name/:email", async (req, res) => {
  try {
    const { email } = req.params;
    const companyName = global.pendingCompanyNames?.[email.toLowerCase()];
    
    res.json({ companyName: companyName || null });
  } catch (error) {
    console.error('Get company name error:', error);
    res.status(500).json({ message: 'Failed to get company name' });
  }
});

