/**
 * Activity Logger Utility
 * 
 * Provides functions for logging user activities throughout the platform.
 * Supports tracking changes, metadata, and request context.
 */

import { db } from '../db';
import { activityLogs } from '@shared/schema';
import type { Request } from 'express';
import { logActivityToAxiom } from './axiomActivityLogger';

export interface LogActivityParams {
    tenantId: string;
    userId?: string | null;
    entityType: 'shop' | 'user' | 'appointment' | 'email' | 'contact' | 'newsletter' | 'campaign' | 'tag' | string;
    entityId?: string;
    entityName?: string;
    activityType: 'created' | 'updated' | 'deleted' | 'sent' | 'scheduled' | 'cancelled' | 'archived' | string;
    description?: string;
    changes?: Record<string, { old: any; new: any }>;
    metadata?: Record<string, any>;
    req?: Request; // For IP/User-Agent extraction
}

export const allowedActivityTypes = [
    'sent',
    'delivered',
    'opened',
    'clicked',
    'bounced',
    'complained',
    'unsubscribed',
    'scheduled',
    'queued',
    'failed',
] as const;

/**
 * Logs an activity to the activity_logs table
 */
export async function logActivity(params: LogActivityParams): Promise<void> {
    try {
        const ipAddress = params.req?.ip || params.req?.headers['x-forwarded-for']?.toString() || null;
        const userAgent = params.req?.headers['user-agent'] || null;

        await db.insert(activityLogs).values({
            tenantId: params.tenantId,
            userId: params.userId || null,
            entityType: params.entityType,
            entityId: params.entityId || null,
            entityName: params.entityName || null,
            activityType: params.activityType,
            description: params.description || null,
            changes: params.changes ? JSON.stringify(params.changes) : null,
            metadata: params.metadata ? JSON.stringify(params.metadata) : null,
            ipAddress,
            userAgent,
        });

        // Dual-write to Axiom (fire-and-forget, never blocks)
        logActivityToAxiom(params).catch(() => {});
    } catch (error) {
        // Log error but don't throw - activity logging should never break main flows
        console.error('[ActivityLogger] Failed to log activity:', error);
    }
}

/**
 * Computes the differences between old and new data objects
 * Returns an object with fields that have changed and their old/new values
 */
export function computeChanges(
    oldData: Record<string, any>,
    newData: Record<string, any>,
    fieldsToTrack?: string[]
): Record<string, { old: any; new: any }> | null {
    const changes: Record<string, { old: any; new: any }> = {};

    // Determine which fields to compare
    const keysToCheck = fieldsToTrack || Array.from(new Set([...Object.keys(oldData), ...Object.keys(newData)]));

    for (const key of keysToCheck) {
        // Skip internal/meta fields
        if (['id', 'tenantId', 'createdAt', 'updatedAt'].includes(key)) {
            continue;
        }

        const oldValue = oldData[key];
        const newValue = newData[key];

        // Compare as JSON strings for objects/arrays, direct comparison for primitives
        const oldStr = typeof oldValue === 'object' ? JSON.stringify(oldValue) : oldValue;
        const newStr = typeof newValue === 'object' ? JSON.stringify(newValue) : newValue;

        if (oldStr !== newStr) {
            changes[key] = { old: oldValue ?? null, new: newValue ?? null };
        }
    }

    return Object.keys(changes).length > 0 ? changes : null;
}

/**
 * Fields to track for shop entity updates
 */
export const SHOP_TRACKED_FIELDS = [
    'name',
    'description',
    'address',
    'city',
    'state',
    'zipCode',
    'country',
    'phone',
    'email',
    'website',
    'operatingHours',
    'status',
    'category',
    'managerId',
    'tags',
    'isActive',
];

/**
 * Fields to track for user entity updates
 */
export const USER_TRACKED_FIELDS = [
    'firstName',
    'lastName',
    'email',
    'role',
    'isActive',
];
