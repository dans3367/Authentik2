import { db } from "./db";
import { sql } from "drizzle-orm";
import { inngest } from "./client";

export type InngestEventStatus = 'pending' | 'sent' | 'processing' | 'completed' | 'failed' | 'cancelled';
export type InngestEventRelatedType = 'appointment_reminder' | 'newsletter' | 'email' | 'bulk_email' | 'scheduled_email';

export interface TrackedEventOptions {
  tenantId?: string;
  idempotencyKey?: string;
  scheduledFor?: Date;
  relatedType?: InngestEventRelatedType;
  relatedId?: string;
}

export interface TrackedEventResult {
  success: boolean;
  eventTrackingId: string;
  inngestEventId?: string;
  error?: string;
}

/**
 * Records an event in the database before sending to Inngest.
 * This ensures we have a record even if Inngest is unavailable.
 */
async function recordEvent(
  eventName: string,
  eventData: any,
  options: TrackedEventOptions = {}
): Promise<string> {
  const result = await db.execute(sql`
    INSERT INTO inngest_events (
      tenant_id,
      event_name,
      event_data,
      idempotency_key,
      scheduled_for,
      related_type,
      related_id,
      status
    ) VALUES (
      ${options.tenantId || null},
      ${eventName},
      ${JSON.stringify(eventData)},
      ${options.idempotencyKey || null},
      ${options.scheduledFor || null},
      ${options.relatedType || null},
      ${options.relatedId || null},
      'pending'
    )
    RETURNING id
  `);
  
  return (result.rows[0] as any).id;
}

/**
 * Updates the event status after sending to Inngest
 */
async function updateEventStatus(
  eventId: string,
  status: InngestEventStatus,
  inngestEventId?: string,
  errorMessage?: string
): Promise<void> {
  await db.execute(sql`
    UPDATE inngest_events
    SET 
      status = ${status},
      event_id = COALESCE(${inngestEventId || null}, event_id),
      error_message = ${errorMessage || null},
      sent_at = CASE WHEN ${status} = 'sent' THEN NOW() ELSE sent_at END,
      updated_at = NOW()
    WHERE id = ${eventId}
  `);
}

/**
 * Marks an event as completed with result
 */
export async function markEventCompleted(
  inngestEventId: string,
  result?: any
): Promise<void> {
  await db.execute(sql`
    UPDATE inngest_events
    SET 
      status = 'completed',
      result = ${result ? JSON.stringify(result) : null},
      completed_at = NOW(),
      updated_at = NOW()
    WHERE event_id = ${inngestEventId}
  `);
}

/**
 * Marks an event as failed
 */
export async function markEventFailed(
  inngestEventId: string,
  errorMessage: string
): Promise<void> {
  await db.execute(sql`
    UPDATE inngest_events
    SET 
      status = 'failed',
      error_message = ${errorMessage},
      retry_count = retry_count + 1,
      last_retry_at = NOW(),
      updated_at = NOW()
    WHERE event_id = ${inngestEventId}
  `);
}

/**
 * Sends an event to Inngest with tracking.
 * Records the event in the database before sending, then updates status after.
 */
export async function sendTrackedEvent(
  eventName: string,
  eventData: any,
  options: TrackedEventOptions = {}
): Promise<TrackedEventResult> {
  // First, record the event in our database
  const trackingId = await recordEvent(eventName, eventData, options);
  
  try {
    // Send to Inngest
    const result = await inngest.send({
      name: eventName,
      data: eventData,
    });
    
    // Get the event ID from the result
    const inngestEventId = result.ids?.[0];
    
    // Update status to sent
    await updateEventStatus(trackingId, 'sent', inngestEventId);
    
    console.log(`📊 [EventTracker] Event ${eventName} tracked (ID: ${trackingId}, Inngest: ${inngestEventId})`);
    
    return {
      success: true,
      eventTrackingId: trackingId,
      inngestEventId,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // Update status to failed
    await updateEventStatus(trackingId, 'failed', undefined, errorMessage);
    
    console.error(`📊 [EventTracker] Failed to send event ${eventName}:`, errorMessage);
    
    return {
      success: false,
      eventTrackingId: trackingId,
      error: errorMessage,
    };
  }
}

/**
 * Gets all pending events that need to be resent (for recovery)
 */
export async function getPendingEvents(): Promise<any[]> {
  const result = await db.execute(sql`
    SELECT 
      id,
      tenant_id,
      event_name,
      event_data,
      idempotency_key,
      scheduled_for,
      related_type,
      related_id,
      retry_count,
      max_retries,
      created_at
    FROM inngest_events
    WHERE status IN ('pending', 'failed')
      AND (retry_count < max_retries OR max_retries IS NULL)
    ORDER BY created_at ASC
  `);
  
  return result.rows.map((row: any) => ({
    ...row,
    eventData: JSON.parse(row.event_data),
  }));
}

/**
 * Gets events by status for monitoring
 */
export async function getEventsByStatus(
  status: InngestEventStatus,
  limit: number = 100
): Promise<any[]> {
  const result = await db.execute(sql`
    SELECT 
      id,
      tenant_id,
      event_name,
      event_id,
      status,
      related_type,
      related_id,
      error_message,
      retry_count,
      created_at,
      sent_at,
      completed_at
    FROM inngest_events
    WHERE status = ${status}
    ORDER BY created_at DESC
    LIMIT ${limit}
  `);
  
  return result.rows;
}

/**
 * Resends all pending/failed events (for recovery after Inngest outage)
 */
export async function resendPendingEvents(): Promise<{
  total: number;
  success: number;
  failed: number;
  results: Array<{ id: string; success: boolean; error?: string }>;
}> {
  const pendingEvents = await getPendingEvents();
  const results: Array<{ id: string; success: boolean; error?: string }> = [];
  
  console.log(`📊 [EventTracker] Resending ${pendingEvents.length} pending events...`);
  
  for (const event of pendingEvents) {
    try {
      // Update retry count
      await db.execute(sql`
        UPDATE inngest_events
        SET 
          retry_count = retry_count + 1,
          last_retry_at = NOW(),
          next_retry_at = NULL,
          updated_at = NOW()
        WHERE id = ${event.id}
      `);
      
      // Resend to Inngest
      const result = await inngest.send({
        name: event.event_name,
        data: event.eventData,
      });
      
      const inngestEventId = result.ids?.[0];
      
      // Update status to sent
      await updateEventStatus(event.id, 'sent', inngestEventId);
      
      results.push({ id: event.id, success: true });
      console.log(`📊 [EventTracker] Resent event ${event.id} -> ${inngestEventId}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      await db.execute(sql`
        UPDATE inngest_events
        SET 
          error_message = ${errorMessage},
          updated_at = NOW()
        WHERE id = ${event.id}
      `);
      
      results.push({ id: event.id, success: false, error: errorMessage });
      console.error(`📊 [EventTracker] Failed to resend event ${event.id}:`, errorMessage);
    }
  }
  
  const successCount = results.filter(r => r.success).length;
  const failedCount = results.filter(r => !r.success).length;
  
  console.log(`📊 [EventTracker] Resend complete: ${successCount} success, ${failedCount} failed`);
  
  return {
    total: pendingEvents.length,
    success: successCount,
    failed: failedCount,
    results,
  };
}

/**
 * Gets event statistics for monitoring
 */
export async function getEventStats(): Promise<{
  pending: number;
  sent: number;
  processing: number;
  completed: number;
  failed: number;
  cancelled: number;
  total: number;
}> {
  const result = await db.execute(sql`
    SELECT 
      status,
      COUNT(*) as count
    FROM inngest_events
    GROUP BY status
  `);
  
  const stats = {
    pending: 0,
    sent: 0,
    processing: 0,
    completed: 0,
    failed: 0,
    cancelled: 0,
    total: 0,
  };
  
  for (const row of result.rows as any[]) {
    const status = row.status as keyof typeof stats;
    const count = parseInt(row.count, 10);
    if (status in stats) {
      stats[status] = count;
    }
    stats.total += count;
  }
  
  return stats;
}

/**
 * Cancels a pending event
 */
export async function cancelEvent(eventId: string): Promise<boolean> {
  const result = await db.execute(sql`
    UPDATE inngest_events
    SET 
      status = 'cancelled',
      updated_at = NOW()
    WHERE id = ${eventId}
      AND status IN ('pending', 'failed')
    RETURNING id
  `);
  
  return result.rows.length > 0;
}

/**
 * Gets recent events for a specific tenant
 */
export async function getTenantEvents(
  tenantId: string,
  limit: number = 50
): Promise<any[]> {
  const result = await db.execute(sql`
    SELECT 
      id,
      event_name,
      event_id,
      status,
      related_type,
      related_id,
      error_message,
      created_at,
      sent_at,
      completed_at
    FROM inngest_events
    WHERE tenant_id = ${tenantId}
    ORDER BY created_at DESC
    LIMIT ${limit}
  `);
  
  return result.rows;
}
