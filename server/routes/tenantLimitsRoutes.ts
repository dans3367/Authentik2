import { Router } from 'express';
import { authenticateToken, requireRole } from '../middleware/auth-middleware';
import { storage } from '../storage';
import { createTenantLimitsSchema, updateTenantLimitsSchema } from '@shared/schema';
import { sanitizeString } from '../utils/sanitization';

export const tenantLimitsRoutes = Router();

// Get tenant limits for a specific tenant
tenantLimitsRoutes.get('/:tenantId', authenticateToken, requireRole(['Owner', 'Administrator']), async (req: any, res) => {
  try {
    const { tenantId } = req.params;
    
    // Only allow access to own tenant unless user is super admin
    if (req.user.role !== 'SuperAdmin' && req.user.tenantId !== tenantId) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    const limits = await storage.getTenantLimits(tenantId);
    const currentLimits = await storage.checkShopLimits(tenantId);
    
    res.json({
      customLimits: limits,
      currentLimits,
      events: await storage.getShopLimitEvents(tenantId, { 
        eventType: undefined,
        fromDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
      })
    });
  } catch (error) {
    console.error('Get tenant limits error:', error);
    res.status(500).json({ message: 'Failed to get tenant limits' });
  }
});

// Create or update tenant limits
tenantLimitsRoutes.post('/:tenantId', authenticateToken, requireRole(['Owner', 'Administrator']), async (req: any, res) => {
  try {
    const { tenantId } = req.params;
    
    // Only allow access to own tenant unless user is super admin
    if (req.user.role !== 'SuperAdmin' && req.user.tenantId !== tenantId) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    const validatedData = createTenantLimitsSchema.parse(req.body);
    
    // Sanitize text fields
    const sanitizedData = {
      ...validatedData,
      overrideReason: validatedData.overrideReason ? sanitizeString(validatedData.overrideReason) : undefined,
      customLimits: sanitizeString(validatedData.customLimits || '{}')
    };
    
    // Check if limits already exist
    const existingLimits = await storage.getTenantLimits(tenantId);
    
    let result;
    if (existingLimits) {
      result = await storage.updateTenantLimits(tenantId, sanitizedData);
    } else {
      result = await storage.createTenantLimits(tenantId, sanitizedData, req.user.id);
    }
    
    res.json({
      message: existingLimits ? 'Tenant limits updated successfully' : 'Tenant limits created successfully',
      limits: result
    });
  } catch (error) {
    console.error('Create/update tenant limits error:', error);
    if (error instanceof Error && error.message.includes('validation')) {
      return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: 'Failed to create/update tenant limits' });
  }
});

// Update tenant limits
tenantLimitsRoutes.put('/:tenantId', authenticateToken, requireRole(['Owner', 'Administrator']), async (req: any, res) => {
  try {
    const { tenantId } = req.params;
    
    // Only allow access to own tenant unless user is super admin
    if (req.user.role !== 'SuperAdmin' && req.user.tenantId !== tenantId) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    const validatedData = updateTenantLimitsSchema.parse(req.body);
    
    // Sanitize text fields
    const sanitizedData = {
      ...validatedData,
      overrideReason: validatedData.overrideReason ? sanitizeString(validatedData.overrideReason) : undefined,
      ...(validatedData.customLimits && { customLimits: sanitizeString(validatedData.customLimits) })
    };
    
    const result = await storage.updateTenantLimits(tenantId, sanitizedData);
    
    if (!result) {
      return res.status(404).json({ message: 'Tenant limits not found' });
    }
    
    res.json({
      message: 'Tenant limits updated successfully',
      limits: result
    });
  } catch (error) {
    console.error('Update tenant limits error:', error);
    if (error instanceof Error && error.message.includes('validation')) {
      return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: 'Failed to update tenant limits' });
  }
});

// Delete tenant limits (revert to subscription plan limits)
tenantLimitsRoutes.delete('/:tenantId', authenticateToken, requireRole(['Owner', 'Administrator']), async (req: any, res) => {
  try {
    const { tenantId } = req.params;
    
    // Only allow access to own tenant unless user is super admin
    if (req.user.role !== 'SuperAdmin' && req.user.tenantId !== tenantId) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    await storage.deleteTenantLimits(tenantId);
    
    // Log the limit removal event
    const currentShops = await storage.getCurrentShopCount(tenantId);
    await storage.logShopLimitEvent(tenantId, 'limit_decreased', currentShops, undefined, {
      action: 'custom_limits_removed',
      removedBy: req.user.id
    });
    
    res.json({ message: 'Tenant limits removed successfully. Reverted to subscription plan limits.' });
  } catch (error) {
    console.error('Delete tenant limits error:', error);
    res.status(500).json({ message: 'Failed to delete tenant limits' });
  }
});

// Get shop limit events for analytics
tenantLimitsRoutes.get('/:tenantId/events', authenticateToken, requireRole(['Owner', 'Administrator']), async (req: any, res) => {
  try {
    const { tenantId } = req.params;
    const { eventType, fromDate, toDate, limit = 50 } = req.query;
    
    // Only allow access to own tenant unless user is super admin
    if (req.user.role !== 'SuperAdmin' && req.user.tenantId !== tenantId) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    const filters: any = {};
    
    if (eventType) {
      filters.eventType = eventType;
    }
    
    if (fromDate) {
      filters.fromDate = new Date(fromDate as string);
    }
    
    if (toDate) {
      filters.toDate = new Date(toDate as string);
    }
    
    const events = await storage.getShopLimitEvents(tenantId, filters);
    
    res.json({
      events: events.slice(0, Number(limit)),
      total: events.length
    });
  } catch (error) {
    console.error('Get shop limit events error:', error);
    res.status(500).json({ message: 'Failed to get shop limit events' });
  }
});

// Get current shop usage and limits summary
tenantLimitsRoutes.get('/:tenantId/summary', authenticateToken, requireRole(['Owner', 'Administrator']), async (req: any, res) => {
  try {
    const { tenantId } = req.params;
    
    // Only allow access to own tenant unless user is super admin
    if (req.user.role !== 'SuperAdmin' && req.user.tenantId !== tenantId) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    const limits = await storage.checkShopLimits(tenantId);
    const customLimits = await storage.getTenantLimits(tenantId);
    const subscription = await storage.getTenantSubscription(tenantId);
    
    // Get recent events for trend analysis
    const recentEvents = await storage.getShopLimitEvents(tenantId, {
      fromDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
    });
    
    res.json({
      currentUsage: {
        shops: limits.currentShops,
        maxShops: limits.maxShops,
        canAddShop: limits.canAddShop,
        remainingShops: limits.maxShops ? limits.maxShops - limits.currentShops : null
      },
      planInfo: {
        name: limits.planName,
        isCustomLimit: limits.isCustomLimit,
        customLimitReason: limits.customLimitReason,
        expiresAt: limits.expiresAt
      },
      subscription: subscription ? {
        planName: subscription.plan.displayName,
        status: subscription.status,
        currentPeriodEnd: subscription.currentPeriodEnd
      } : null,
      customLimits,
      recentActivity: {
        totalEvents: recentEvents.length,
        eventsByType: recentEvents.reduce((acc, event) => {
          acc[event.eventType] = (acc[event.eventType] || 0) + 1;
          return acc;
        }, {} as Record<string, number>)
      }
    });
  } catch (error) {
    console.error('Get tenant limits summary error:', error);
    res.status(500).json({ message: 'Failed to get tenant limits summary' });
  }
});