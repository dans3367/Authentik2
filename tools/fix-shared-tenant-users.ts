import './server/config';
import { db } from './server/db';
import { betterAuthUser, tenants, companies } from '@shared/schema';
import { eq } from 'drizzle-orm';

/**
 * Fix users who are sharing a tenant - give each their own unique tenant
 * Usage: npx tsx fix-shared-tenant-users.ts <tenant-id>
 * Example: npx tsx fix-shared-tenant-users.ts 29c69b4f-3129-4aa4-a475-7bf892e5c5b9
 */

async function fixSharedTenantUsers() {
  const targetTenantId = process.argv[2] || '29c69b4f-3129-4aa4-a475-7bf892e5c5b9';
  
  console.log('🔧 Fixing users in shared tenant:', targetTenantId);
  console.log('='.repeat(60));
  console.log('');

  // Get all users in this tenant
  const users = await db.query.betterAuthUser.findMany({
    where: eq(betterAuthUser.tenantId, targetTenantId),
    columns: {
      id: true,
      email: true,
      name: true,
      role: true,
      tenantId: true,
    },
  });

  console.log(`Found ${users.length} users in tenant ${targetTenantId}:\n`);
  
  for (let i = 0; i < users.length; i++) {
    console.log(`${i + 1}. ${users[i].email} (${users[i].name}) - Role: ${users[i].role}`);
  }
  
  console.log('');
  console.log('='.repeat(60));
  console.log('Starting to create unique tenants for each user...');
  console.log('='.repeat(60));
  console.log('');

  let successCount = 0;
  let errorCount = 0;

  for (const user of users) {
    try {
      console.log(`\n🔧 Processing: ${user.email}`);
      console.log('-'.repeat(60));

      // Generate unique slug
      let baseSlug = user.email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '-');
      let slug = baseSlug;
      let attempts = 0;

      while (attempts < 10) {
        const existingTenant = await db.query.tenants.findFirst({
          where: eq(tenants.slug, slug),
        });

        if (!existingTenant) break;

        attempts++;
        slug = `${baseSlug}-${attempts}`;
      }

      if (attempts >= 10) {
        throw new Error('Could not generate unique slug');
      }

      // Create new tenant
      const companyName = user.name ? `${user.name}'s Company` : 'My Company';

      console.log(`  📝 Creating tenant: ${companyName} (${slug})`);
      const [newTenant] = await db
        .insert(tenants)
        .values({
          name: companyName,
          slug: slug,
          isActive: true,
          maxUsers: 10,
        })
        .returning();

      console.log(`  ✅ Tenant created: ${newTenant.id}`);

      // Update user
      console.log(`  📝 Updating user...`);
      await db
        .update(betterAuthUser)
        .set({
          tenantId: newTenant.id,
          role: 'Owner',
          updatedAt: new Date(),
        })
        .where(eq(betterAuthUser.id, user.id));

      console.log(`  ✅ User updated`);

      // Create company
      console.log(`  📝 Creating company...`);
      const [newCompany] = await db
        .insert(companies)
        .values({
          tenantId: newTenant.id,
          ownerId: user.id,
          name: companyName,
          setupCompleted: true,
          isActive: true,
        })
        .returning();

      console.log(`  ✅ Company created: ${newCompany.id}`);
      console.log(`  🎉 SUCCESS for ${user.email}`);
      successCount++;
    } catch (error) {
      console.error(`  ❌ ERROR for ${user.email}:`, error);
      errorCount++;
    }
  }

  console.log('');
  console.log('='.repeat(60));
  console.log('📊 Summary:');
  console.log('='.repeat(60));
  console.log(`Total users processed: ${users.length}`);
  console.log(`✅ Successful: ${successCount}`);
  console.log(`❌ Failed: ${errorCount}`);
  console.log('');
  
  if (successCount > 0) {
    console.log('✅ Users now have unique tenants and will see only their own data.');
  }
  
  if (errorCount > 0) {
    console.log('⚠️  Some users failed. Check the error messages above.');
  }

  process.exit(errorCount > 0 ? 1 : 0);
}

fixSharedTenantUsers().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});


