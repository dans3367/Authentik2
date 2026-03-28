import { db } from '../server/db';
import { appointments, shops } from '../shared/schema';
import { sql } from 'drizzle-orm';

async function run() {
  const nhShops = await db
    .select({ id: shops.id, tenantId: shops.tenantId, name: shops.name })
    .from(shops)
    .where(sql`LOWER(TRIM(${shops.name})) = 'north hollywood'`);

  console.log('North Hollywood shops found:', nhShops);

  if (nhShops.length === 0) {
    console.log('No North Hollywood shop found. Exiting.');
    return;
  }

  const [{ count }] = await db
    .select({ count: sql<number>`CAST(COUNT(*) AS INT)` })
    .from(appointments)
    .where(sql`
      ${appointments.shopId} IS NULL
      AND EXISTS (
        SELECT 1
        FROM ${shops}
        WHERE ${shops.tenantId} = ${appointments.tenantId}
          AND LOWER(TRIM(${shops.name})) = 'north hollywood'
      )
    `);

  console.log(`Will update ${count} appointments.`);

  await db.execute(sql`
    WITH target_shops AS (
      SELECT DISTINCT ON (tenant_id)
        id,
        tenant_id,
        name
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
  `);

  console.log(`Finished updating up to ${count} appointments.`);
  console.log('Done.');
}

run().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
