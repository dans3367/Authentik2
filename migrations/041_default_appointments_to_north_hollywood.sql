-- Default existing appointments with no shopId to the "North Hollywood" shop.
-- Resolve one deterministic target shop per tenant using an exact normalized name match.

WITH target_shops AS (
  SELECT DISTINCT ON (tenant_id)
    id,
    tenant_id
  FROM shops
  WHERE LOWER(TRIM(name)) = 'north hollywood'
  ORDER BY tenant_id, is_default DESC, created_at ASC, id ASC
)
UPDATE appointments
SET shop_id = target_shops.id,
    updated_at = NOW()
FROM target_shops
WHERE appointments.tenant_id = target_shops.tenant_id
  AND appointments.shop_id IS NULL;
