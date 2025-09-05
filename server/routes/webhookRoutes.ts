import { Router } from 'express';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { authenticateToken } from '../middleware/auth-middleware';
import { createHmac } from 'crypto';

export const webhookRoutes = Router();

// Resend webhook endpoint
webhookRoutes.get("/resend", async (req, res) => {
  try {
    res.json({ message: 'Resend webhook endpoint is active' });
  } catch (error) {
    console.error('Resend webhook GET error:', error);
    res.status(500).json({ message: 'Webhook error' });
  }
});

// Test webhook open endpoint
webhookRoutes.post("/test/webhook-open", authenticateToken, async (req: any, res) => {
  try {
    const { email, newsletterId, timestamp } = req.body;

    if (!email || !newsletterId) {
      return res.status(400).json({ message: 'Email and newsletterId are required' });
    }

    // Log the webhook event
    console.log('Webhook open event received:', {
      email,
      newsletterId,
      timestamp: timestamp || new Date().toISOString(),
      userAgent: req.get('User-Agent'),
      ip: req.ip,
    });

    // Here you would typically:
    // 1. Update email tracking statistics
    // 2. Update contact engagement metrics
    // 3. Trigger any follow-up actions

    res.json({
      message: 'Webhook open event processed successfully',
      received: {
        email,
        newsletterId,
        timestamp: timestamp || new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Test webhook open error:', error);
    res.status(500).json({ message: 'Failed to process webhook open event' });
  }
});

// Resend webhook endpoint (POST)
webhookRoutes.post("/resend", async (req, res) => {
  try {
    const signature = req.headers['resend-signature'] as string;
    const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.error('RESEND_WEBHOOK_SECRET not configured');
      return res.status(500).json({ message: 'Webhook secret not configured' });
    }

    // Verify webhook signature
    if (signature) {
      const expectedSignature = createHmac('sha256', webhookSecret)
        .update(JSON.stringify(req.body))
        .digest('hex');

      if (signature !== expectedSignature) {
        console.error('Invalid webhook signature');
        return res.status(401).json({ message: 'Invalid signature' });
      }
    }

    const event = req.body;

    console.log('Resend webhook event received:', {
      type: event.type,
      data: event.data,
      timestamp: new Date().toISOString(),
    });

    // Handle different event types
    switch (event.type) {
      case 'email.sent':
        await handleEmailSent(event.data);
        break;
      case 'email.delivered':
        await handleEmailDelivered(event.data);
        break;
      case 'email.bounced':
        await handleEmailBounced(event.data);
        break;
      case 'email.complained':
        await handleEmailComplained(event.data);
        break;
      case 'email.opened':
        await handleEmailOpened(event.data);
        break;
      case 'email.clicked':
        await handleEmailClicked(event.data);
        break;
      default:
        console.log(`Unhandled Resend event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Resend webhook error:', error);
    res.status(500).json({ message: 'Webhook processing failed' });
  }
});

// Postmark webhook endpoint
webhookRoutes.post("/postmark", async (req, res) => {
  try {
    const signature = req.headers['x-postmark-signature'] as string;
    const webhookSecret = process.env.POSTMARK_WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.error('POSTMARK_WEBHOOK_SECRET not configured');
      return res.status(500).json({ message: 'Webhook secret not configured' });
    }

    // Verify webhook signature
    if (signature) {
      const expectedSignature = createHmac('sha256', webhookSecret)
        .update(JSON.stringify(req.body))
        .digest('hex');

      if (signature !== expectedSignature) {
        console.error('Invalid Postmark webhook signature');
        return res.status(401).json({ message: 'Invalid signature' });
      }
    }

    const event = req.body;

    console.log('Postmark webhook event received:', {
      type: event.RecordType,
      data: event,
      timestamp: new Date().toISOString(),
    });

    // Handle different event types
    switch (event.RecordType) {
      case 'Sent':
        await handleEmailSent(event);
        break;
      case 'Delivered':
        await handleEmailDelivered(event);
        break;
      case 'Bounce':
        await handleEmailBounced(event);
        break;
      case 'SpamComplaint':
        await handleEmailComplained(event);
        break;
      case 'Open':
        await handleEmailOpened(event);
        break;
      case 'Click':
        await handleEmailClicked(event);
        break;
      default:
        console.log(`Unhandled Postmark event type: ${event.RecordType}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Postmark webhook error:', error);
    res.status(500).json({ message: 'Webhook processing failed' });
  }
});

// Helper functions for webhook event handling
async function handleEmailSent(data: any) {
  try {
    console.log('Email sent event:', data);
    
    // Update email tracking statistics
    // You might want to store this in a database table for analytics
    
    // Example: Update newsletter send count
    if (data.newsletterId) {
      // Update newsletter statistics
      console.log(`Newsletter ${data.newsletterId} email sent to ${data.email}`);
    }
  } catch (error) {
    console.error('Error handling email sent event:', error);
  }
}

async function handleEmailDelivered(data: any) {
  try {
    console.log('Email delivered event:', data);
    
    // Update delivery statistics
    if (data.newsletterId) {
      console.log(`Newsletter ${data.newsletterId} email delivered to ${data.email}`);
    }
  } catch (error) {
    console.error('Error handling email delivered event:', error);
  }
}

async function handleEmailBounced(data: any) {
  try {
    console.log('Email bounced event:', data);
    
    // Add to bounced emails table
    const email = data.email || data.Email;
    const reason = data.reason || data.Type || 'bounce';
    const description = data.description || data.Description || 'Email bounced';

    if (email) {
      // Check if already exists
      const existingBounce = await db.query.bouncedEmails.findFirst({
        where: sql`${db.bouncedEmails.email} = ${email}`,
      });

      if (!existingBounce) {
        await db.insert(db.bouncedEmails).values({
          email,
          reason,
          description,
          bouncedAt: new Date(),
        });
        console.log(`Added bounced email: ${email}`);
      }
    }
  } catch (error) {
    console.error('Error handling email bounced event:', error);
  }
}

async function handleEmailComplained(data: any) {
  try {
    console.log('Email complained event:', data);
    
    // Add to bounced emails table with spam complaint reason
    const email = data.email || data.Email;
    const reason = 'spam_complaint';
    const description = 'Spam complaint received';

    if (email) {
      // Check if already exists
      const existingBounce = await db.query.bouncedEmails.findFirst({
        where: sql`${db.bouncedEmails.email} = ${email}`,
      });

      if (!existingBounce) {
        await db.insert(db.bouncedEmails).values({
          email,
          reason,
          description,
          bouncedAt: new Date(),
        });
        console.log(`Added spam complaint: ${email}`);
      }
    }
  } catch (error) {
    console.error('Error handling email complained event:', error);
  }
}

async function handleEmailOpened(data: any) {
  try {
    console.log('Email opened event:', data);
    
    // Update open tracking statistics
    if (data.newsletterId) {
      console.log(`Newsletter ${data.newsletterId} email opened by ${data.email}`);
    }
  } catch (error) {
    console.error('Error handling email opened event:', error);
  }
}

async function handleEmailClicked(data: any) {
  try {
    console.log('Email clicked event:', data);
    
    // Update click tracking statistics
    if (data.newsletterId) {
      console.log(`Newsletter ${data.newsletterId} email clicked by ${data.email}`);
    }
  } catch (error) {
    console.error('Error handling email clicked event:', error);
  }
}