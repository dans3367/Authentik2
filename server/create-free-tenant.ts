import './config';
import { db } from './db';
import { tenants, betterAuthUser, betterAuthAccount, companies, subscriptions, subscriptionPlans } from '@shared/schema';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';
import readline from 'readline';

async function createFreeTenant() {
  try {
    console.log('🔄 Creating new tenant with Free plan...');

    let email = process.env.TENANT_EMAIL;
    let password = process.env.TENANT_PASSWORD;

    if (!email) {
      if (process.env.CI) {
        console.error('❌ Error: TENANT_EMAIL must be set in CI environment.');
        process.exit(1);
      }

      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      email = await new Promise((resolve) => {
        rl.question('Enter email for new tenant: ', (answer: string) => {
          rl.close();
          resolve(answer.trim());
        });
      });
    }

    if (!email) {
      console.error('❌ Email is required.');
      process.exit(1);
    }

    if (!password) {
      if (!process.env.CI) {
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout,
        });

        const inputPassword = await new Promise<string>((resolve) => {
          rl.question('Enter password (leave empty to generate random): ', (answer: string) => {
            rl.close();
            resolve(answer.trim());
          });
        });

        if (inputPassword) {
          password = inputPassword;
        }
      }
    }

    if (!password) {
      if (process.env.CI) {
        console.error('❌ Error: TENANT_PASSWORD must be set in CI environment.');
        process.exit(1);
      }
      password = crypto.randomBytes(16).toString('hex');
      console.warn('⚠️  Generated random password.');
      console.warn('   The secret will not be printed to logs and should be saved securely.');
    }

    const companyName = 'Free Plan Demo Inc';
    const firstName = 'Free';
    const lastName = 'Owner';

    // 1. Check if user already exists
    const existing = await db.query.betterAuthUser.findFirst({
      where: eq(betterAuthUser.email, email),
    });
    if (existing) {
      console.error(`❌ User ${email} already exists. Aborting.`);
      process.exit(1);
    }

    // 2. Create tenant
    const slug = email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '-');
    const [newTenant] = await db.insert(tenants).values({
      name: companyName,
      slug,
      isActive: true,
      maxUsers: 1,
    }).returning();
    console.log(`✅ Tenant created: ${newTenant.name} (${newTenant.id})`);

    // 3. Create user
    const userId = crypto.randomUUID().replace(/-/g, '');
    const [newUser] = await db.insert(betterAuthUser).values({
      id: userId,
      email,
      name: `${firstName} ${lastName}`,
      firstName,
      lastName,
      role: 'Owner',
      tenantId: newTenant.id,
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();
    console.log(`✅ User created: ${newUser.email} (${newUser.id})`);

    // 4. Create credential account with hashed password
    const { hashPassword } = await import('better-auth/crypto');
    const hashedPassword = await hashPassword(password);
    await db.insert(betterAuthAccount).values({
      id: crypto.randomUUID(),
      userId: newUser.id,
      accountId: newUser.id,
      providerId: 'credential',
      password: hashedPassword,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    console.log(`✅ Credential account created`);

    // 5. Create company record
    const [newCompany] = await db.insert(companies).values({
      tenantId: newTenant.id,
      ownerId: newUser.id,
      name: companyName,
      setupCompleted: true,
      isActive: true,
    }).returning();
    console.log(`✅ Company created: ${newCompany.name} (${newCompany.id})`);

    // 6. Find Free plan and create subscription
    const freePlan = await db.query.subscriptionPlans.findFirst({
      where: eq(subscriptionPlans.name, 'Free'),
    });

    if (!freePlan) {
      console.error('❌ Free plan not found. Run setup-subscription-plans first.');
      process.exit(1);
    }

    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setFullYear(periodEnd.getFullYear() + 1);

    await db.insert(subscriptions).values({
      tenantId: newTenant.id,
      userId: newUser.id,
      planId: freePlan.id,
      stripeSubscriptionId: `free_${newTenant.id}`,
      stripeCustomerId: `free_customer_${newTenant.id}`,
      status: 'active',
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: false,
      isYearly: false,
    });
    console.log(`✅ Free plan subscription assigned`);

    console.log(`\n🎉 Done! New Free plan tenant created:`);
    console.log(`   Email: ${email}`);
    // Password output removed for security
    console.log(`   Company: ${companyName}`);
    console.log(`   Tenant ID: ${newTenant.id}`);
    console.log(`   Plan: Free`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Failed:', error);
    process.exit(1);
  }
}

createFreeTenant();
