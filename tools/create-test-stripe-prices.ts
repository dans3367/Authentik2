import '../server/config';
import Stripe from 'stripe';

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
if (!STRIPE_SECRET_KEY || !STRIPE_SECRET_KEY.includes('_test_')) {
  console.error('❌ STRIPE_SECRET_KEY must be set and must be a test key (must include "_test_"). Aborting.');
  process.exit(1);
}
const stripe = new Stripe(STRIPE_SECRET_KEY);

async function createTestPrices() {
  console.log('Creating test mode products and prices in Stripe...\n');

  // 1. Free Plan - $0/mo, $0/yr
  const freeProd = await stripe.products.create({
    name: 'Free Plan',
    description: 'Get started with the essentials — single user, single login',
  }, { idempotencyKey: 'seed:product:free-plan' });
  console.log(`✅ Free Product: ${freeProd.id}`);

  const freeMonthly = await stripe.prices.create({
    product: freeProd.id,
    unit_amount: 0,
    currency: 'usd',
    recurring: { interval: 'month' },
  }, { idempotencyKey: 'seed:price:free-plan:monthly' });
  console.log(`   Monthly price: ${freeMonthly.id} ($0/mo)`);

  const freeYearly = await stripe.prices.create({
    product: freeProd.id,
    unit_amount: 0,
    currency: 'usd',
    recurring: { interval: 'year' },
  }, { idempotencyKey: 'seed:price:free-plan:yearly' });
  console.log(`   Yearly price:  ${freeYearly.id} ($0/yr)\n`);

  // 2. Plus Plan - $49/mo, $470.40/yr
  const plusProd = await stripe.products.create({
    name: 'Plus Plan',
    description: 'For growing businesses — add team members and shops',
  }, { idempotencyKey: 'seed:product:plus-plan' });
  console.log(`✅ Plus Product: ${plusProd.id}`);

  const plusMonthly = await stripe.prices.create({
    product: plusProd.id,
    unit_amount: 4900,
    currency: 'usd',
    recurring: { interval: 'month' },
  }, { idempotencyKey: 'seed:price:plus-plan:monthly' });
  console.log(`   Monthly price: ${plusMonthly.id} ($49/mo)`);

  const plusYearly = await stripe.prices.create({
    product: plusProd.id,
    unit_amount: 47040,
    currency: 'usd',
    recurring: { interval: 'year' },
  }, { idempotencyKey: 'seed:price:plus-plan:yearly' });
  console.log(`   Yearly price:  ${plusYearly.id} ($470.40/yr)\n`);

  // 3. Pro Plan - $79/mo, $758.40/yr
  const proProd = await stripe.products.create({
    name: 'Pro Plan',
    description: 'For established businesses — full power with more capacity',
  }, { idempotencyKey: 'seed:product:pro-plan' });
  console.log(`✅ Pro Product: ${proProd.id}`);

  const proMonthly = await stripe.prices.create({
    product: proProd.id,
    unit_amount: 7900,
    currency: 'usd',
    recurring: { interval: 'month' },
  }, { idempotencyKey: 'seed:price:pro-plan:monthly' });
  console.log(`   Monthly price: ${proMonthly.id} ($79/mo)`);

  const proYearly = await stripe.prices.create({
    product: proProd.id,
    unit_amount: 75840,
    currency: 'usd',
    recurring: { interval: 'year' },
  }, { idempotencyKey: 'seed:price:pro-plan:yearly' });
  console.log(`   Yearly price:  ${proYearly.id} ($758.40/yr)\n`);

  // Output the config block
  console.log('='.repeat(60));
  console.log('Copy these IDs into setup-subscription-plans.ts:');
  console.log('='.repeat(60));
  console.log(`
// TEST MODE IDs
Free:
  stripePriceId: '${freeMonthly.id}',
  stripeYearlyPriceId: '${freeYearly.id}',

Plus:
  stripePriceId: '${plusMonthly.id}',
  stripeYearlyPriceId: '${plusYearly.id}',

Pro:
  stripePriceId: '${proMonthly.id}',
  stripeYearlyPriceId: '${proYearly.id}',
`);
}

createTestPrices()
  .then(() => {
    console.log('Done!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Failed:', err);
    process.exit(1);
  });
