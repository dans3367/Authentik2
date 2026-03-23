import { Response, NextFunction } from 'express';
import type { AuthRequest } from './auth-middleware';

export interface ShopFilteredRequest extends AuthRequest {
  shopId?: string | null; // null = all shops, string = specific shop
}

/**
 * Middleware that reads the x-shop-id header and attaches req.shopId for
 * downstream route handlers to use for filtering.
 *
 * Runs before authenticateToken in the global middleware chain, so it
 * only reads and validates the header format — it does NOT verify shop
 * ownership here. Tenant isolation is enforced by the WHERE clauses in
 * route handlers (e.g. `AND tenant_id = ? AND shop_id = ?`), which
 * guarantees a shopId from a different tenant matches zero rows.
 */
export const filterByShop = (req: ShopFilteredRequest, _res: Response, next: NextFunction) => {
  const shopIdHeader = req.headers['x-shop-id'] as string | undefined;

  if (!shopIdHeader) {
    req.shopId = null;
    return next();
  }

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(shopIdHeader)) {
    req.shopId = null;
    return next();
  }

  req.shopId = shopIdHeader;
  next();
};
