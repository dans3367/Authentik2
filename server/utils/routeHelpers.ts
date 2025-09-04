import { Request, Response } from 'express';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { users } from '@shared/schema';

// Helper function to get pagination parameters
export function getPaginationParams(req: Request) {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50));
  const offset = (page - 1) * limit;

  return { page, limit, offset };
}

// Helper function to create pagination response
export function createPaginationResponse(data: any[], total: number, page: number, limit: number) {
  return {
    data,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
}

// Helper function to handle database errors
export function handleDatabaseError(error: any, res: Response, operation: string) {
  console.error(`${operation} error:`, error);
  
  if (error.code === '23505') { // Unique constraint violation
    return res.status(400).json({ message: 'Record already exists' });
  }
  
  if (error.code === '23503') { // Foreign key constraint violation
    return res.status(400).json({ message: 'Referenced record not found' });
  }
  
  if (error.code === '23502') { // Not null constraint violation
    return res.status(400).json({ message: 'Required field is missing' });
  }
  
  return res.status(500).json({ message: `${operation} failed` });
}

// Helper function to validate company access
export async function validateCompanyAccess(companyId: string, userId: string): Promise<boolean> {
  try {
    const user = await db.query.users.findFirst({
      where: sql`${db.users.id} = ${userId} AND ${db.users.companyId} = ${companyId}`,
    });
    
    return !!user;
  } catch (error) {
    console.error('Company access validation error:', error);
    return false;
  }
}

// Helper function to get user's company ID
export function getUserCompanyId(req: Request): string | null {
  return req.user?.companyId || null;
}

// Helper function to check if user is owner
export function isOwner(req: Request): boolean {
  return req.user?.role === 'Owner';
}

// Helper function to check if user is admin
export function isAdmin(req: Request): boolean {
  return ['Owner', 'Administrator'].includes(req.user?.role || '');
}

// Helper function to check if user is manager
export function isManager(req: Request): boolean {
  return ['Owner', 'Administrator', 'Manager'].includes(req.user?.role || '');
}

// Helper function to create search conditions
export function createSearchCondition(searchTerm: string, fields: string[]) {
  if (!searchTerm) return sql`1=1`;
  
  const sanitizedSearch = searchTerm.toLowerCase();
  const conditions = fields.map(field => sql`${field} ILIKE ${`%${sanitizedSearch}%`}`);
  
  return sql`(${sql.join(conditions, sql` OR `)})`;
}

// Helper function to create date range condition
export function createDateRangeCondition(startDate?: string, endDate?: string, dateField = 'created_at') {
  let condition = sql`1=1`;
  
  if (startDate) {
    condition = sql`${condition} AND ${dateField} >= ${new Date(startDate)}`;
  }
  
  if (endDate) {
    condition = sql`${condition} AND ${dateField} <= ${new Date(endDate)}`;
  }
  
  return condition;
}

// Helper function to format error response
export function formatErrorResponse(message: string, details?: any) {
  return {
    error: true,
    message,
    ...(details && { details }),
    timestamp: new Date().toISOString(),
  };
}

// Helper function to format success response
export function formatSuccessResponse(data: any, message?: string) {
  return {
    success: true,
    data,
    ...(message && { message }),
    timestamp: new Date().toISOString(),
  };
}

// Helper function to validate required fields
export function validateRequiredFields(body: any, requiredFields: string[]): string[] {
  const missingFields: string[] = [];
  
  for (const field of requiredFields) {
    if (body[field] === undefined || body[field] === null || body[field] === '') {
      missingFields.push(field);
    }
  }
  
  return missingFields;
}

// Helper function to create audit log entry
export async function createAuditLog(
  userId: string,
  action: string,
  resourceType: string,
  resourceId: string,
  details?: any
) {
  try {
    // This would typically go to an audit log table
    console.log('Audit Log:', {
      userId,
      action,
      resourceType,
      resourceId,
      details,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Failed to create audit log:', error);
  }
}