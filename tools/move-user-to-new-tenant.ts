import './server/config';
import { db } from './server/db';
import { betterAuthUser, tenants, companies } from '@shared/schema';
import { eq } from 'drizzle-orm';

/**
 * This script moves a user to a new tenant/company
 * Usage: npx tsx move-user-to-new-tenant.ts <user-email> <new-company-name>
 */

async function moveUserToNewTenant() {
  const userEmail = process.argv[2];
  const newCompanyName = process.argv[3];
  
  if (!userEmail || !newCompanyName) {
    console.log('Usage: npx tsx move-user-to-new-tenant.ts <user-email> <new-company-name>');
    console.log('Example: npx tsx move-user-to-new-tenant.ts beats@zendwise.com "Beats Company"');
    process.exit(1);
  }
  
  console.log('🔍 Moving user to new tenant\n');
  console.log('  User Email:', userEmail);
  console.log('  New Company Name:', newCompanyName);
  console.log('');
  
  // Find the user
  const user = await db.query.betterAuthUser.findFirst({
    where: eq(betterAuthUser.email, userEmail.toLowerCase())
  });
  
  if (!user) {
    console.log('❌ User not found:', userEmail);
    process.exit(1);
  }
  
  console.log('✅ User found:');
  console.log('  - Current Tenant ID:', user.tenantId);
  console.log('  - Current Role:', user.role);
  console.log('');
  
  // Create a new tenant for this user
  const slug = userEmail.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '-');
  
  console.log('📝 Creating new tenant...');
  const [newTenant] = await db.insert(tenants).values({
    name: newCompanyName,
    slug: slug,
    isActive: true,
    maxUsers: 10,
  }).returning();
  
  console.log('✅ Tenant created:');
  console.log('  - Tenant ID:', newTenant.id);
  console.log('  - Tenant Name:', newTenant.name);
  console.log('  - Tenant Slug:', newTenant.slug);
  console.log('');
  
  // Update the user's tenant ID and make them Owner
  console.log('📝 Updating user...');
  await db.update(betterAuthUser)
    .set({
      tenantId: newTenant.id,
      role: 'Owner', // Make them owner of their new tenant
      updatedAt: new Date(),
    })
    .where(eq(betterAuthUser.id, user.id));
  
  console.log('✅ User updated');
  console.log('');
  
  // Create a company record
  console.log('📝 Creating company record...');
  const [newCompany] = await db.insert(companies).values({
    tenantId: newTenant.id,
    ownerId: user.id,
    name: newCompanyName,
    setupCompleted: true,
    isActive: true,
  }).returning();
  
  console.log('✅ Company created:');
  console.log('  - Company ID:', newCompany.id);
  console.log('  - Company Name:', newCompany.name);
  console.log('');
  
  console.log('='.repeat(60));
  console.log('✅ SUCCESS! User moved to new tenant');
  console.log('');
  console.log('Summary:');
  console.log('  - User:', userEmail);
  console.log('  - New Tenant:', newTenant.name, `(${newTenant.id})`);
  console.log('  - New Role: Owner');
  console.log('  - Company:', newCompanyName);
  console.log('');
  console.log('The user will now see only their own templates.');
  console.log('They will not see templates from their previous tenant.');
  console.log('='.repeat(60));
  
  process.exit(0);
}

moveUserToNewTenant().catch(console.error);

