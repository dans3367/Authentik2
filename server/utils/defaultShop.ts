import { db } from '../db';
import { shops } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

/**
 * Returns the default shop ID for a tenant.
 * Looks for a shop with isDefault=true; returns null if none found.
 */
export async function getDefaultShopId(tenantId: string): Promise<string | null> {
  const defaultShop = await db.query.shops.findFirst({
    where: and(eq(shops.tenantId, tenantId), eq(shops.isDefault, true)),
    columns: { id: true },
  });
  return defaultShop?.id ?? null;
}

/**
 * Resolves the shopId to use for a new record:
 *  1. Use the explicitly provided shopId (from x-shop-id header) if present
 *  2. Fall back to the tenant's default shop
 */
export async function resolveShopId(shopId: string | null | undefined, tenantId: string): Promise<string | null> {
  if (shopId) return shopId;
  return getDefaultShopId(tenantId);
}
