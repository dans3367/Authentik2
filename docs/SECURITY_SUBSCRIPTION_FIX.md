# Security Fix: Subscription Upgrade Payment Bypass

## Vulnerability Summary

**Severity**: Critical  
**Date Fixed**: February 10, 2026  
**Affected Endpoint**: `POST /api/subscription/upgrade-subscription`

### Issue Description

The subscription upgrade endpoint allowed authenticated Owners to activate any paid subscription plan without completing payment through Stripe. The endpoint would:

1. Accept any `planId` in the request body
2. Create a fake Stripe subscription ID (`manual_${tenantId}_${Date.now()}`)
3. Immediately activate the subscription with `status: 'active'`
4. Grant full access to paid features

This completely bypassed the payment flow, allowing free users to upgrade to Pro ($29.99/mo) or Enterprise ($99.99/mo) plans without payment.

### Attack Vector

```bash
# Any authenticated Owner could execute:
curl -X POST https://app.example.com/api/subscription/upgrade-subscription \
  -H "Authorization: Bearer <jwt_token>" \
  -H "Content-Type: application/json" \
  -d '{"planId": "pro-plan-id", "billingCycle": "monthly"}'

# Result: Immediate activation of Pro plan with no payment
```

## Fix Implementation

### Changes Made

The endpoint now implements proper payment flow for upgrades to paid plans:

1. **Payment Detection**: Identifies when a user is upgrading to a higher-priced plan
2. **Stripe Checkout Required**: Forces users through Stripe Checkout Session for paid upgrades
3. **Customer Creation**: Creates or retrieves Stripe customer ID
4. **Webhook Activation**: Subscription only activates after successful payment via webhook

### Code Changes

**File**: `server/routes/subscriptionRoutes.ts`

```typescript
// SECURITY: Prevent direct activation of paid plans without payment
if (isUpgradeToPaid) {
  if (!stripe) {
    return res.status(503).json({ 
      message: 'Payment processing is not configured. Please contact support.' 
    });
  }

  // Create Stripe Checkout Session for the upgrade
  const session = await stripe.checkout.sessions.create({
    customer: stripeCustomerId,
    mode: 'subscription',
    // ... checkout configuration
  });

  return res.json({
    requiresPayment: true,
    checkoutUrl: session.url,
    sessionId: session.id,
    message: 'Please complete payment to activate your subscription',
  });
}
```

### Security Guarantees

✅ **Paid upgrades require Stripe Checkout**  
✅ **No fake subscription IDs for paid plans**  
✅ **Activation only via webhook after payment**  
✅ **Free plan downgrades still work without payment**  
✅ **Lateral moves (same price) don't require re-payment**

## Testing the Fix

### Test Case 1: Free to Pro Upgrade (Should Require Payment)

```bash
# Request
POST /api/subscription/upgrade-subscription
{
  "planId": "pro-plan-id",
  "billingCycle": "monthly"
}

# Expected Response
{
  "requiresPayment": true,
  "checkoutUrl": "https://checkout.stripe.com/...",
  "sessionId": "cs_test_...",
  "message": "Please complete payment to activate your subscription"
}
```

### Test Case 2: Pro to Free Downgrade (Should Work Immediately)

```bash
# Request
POST /api/subscription/upgrade-subscription
{
  "planId": "free-plan-id",
  "billingCycle": "monthly"
}

# Expected Response
{
  "message": "Successfully downgraded to Free",
  "plan": "Free",
  "suspendedShops": 5,
  "suspendedUsers": 3
}
```

### Test Case 3: New User Selecting Paid Plan (Should Require Payment)

```bash
# Request (no existing subscription)
POST /api/subscription/upgrade-subscription
{
  "planId": "enterprise-plan-id",
  "billingCycle": "yearly"
}

# Expected Response
{
  "requiresPayment": true,
  "checkoutUrl": "https://checkout.stripe.com/...",
  "sessionId": "cs_test_...",
  "message": "Please complete payment to activate your subscription"
}
```

## Frontend Integration Required

The frontend needs to handle the new response format:

```typescript
// client/src/pages/subscription-settings.tsx (or similar)

const handleUpgrade = async (planId: string, billingCycle: string) => {
  const response = await fetch('/api/subscription/upgrade-subscription', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ planId, billingCycle }),
  });

  const data = await response.json();

  if (data.requiresPayment) {
    // Redirect to Stripe Checkout
    window.location.href = data.checkoutUrl;
  } else {
    // Immediate activation (downgrade or free plan)
    toast.success(data.message);
    refetchSubscription();
  }
};
```

## Webhook Verification

Ensure the Stripe webhook handler properly activates subscriptions:

**File**: `server/routes/webhookRoutes.ts`

```typescript
case 'checkout.session.completed': {
  const session = event.data.object;
  const { tenantId, planId, billingCycle } = session.metadata;

  // Activate subscription after successful payment
  await db.insert(subscriptions).values({
    tenantId,
    planId,
    stripeSubscriptionId: session.subscription,
    stripeCustomerId: session.customer,
    status: 'active',
    // ... other fields
  });
  break;
}
```

## Additional Security Recommendations

1. **Rate Limiting**: Add rate limiting to subscription endpoints to prevent abuse
2. **Audit Logging**: Log all subscription changes with user ID and IP address
3. **Webhook Signature Verification**: Ensure Stripe webhook signatures are validated
4. **Environment Guards**: Consider adding `NODE_ENV` checks for development-only features
5. **Price Validation**: Validate plan prices against Stripe product catalog

## Rollback Plan

If issues arise, the previous behavior can be restored by:

1. Removing the `isUpgradeToPaid` check
2. Allowing direct activation for all plans

**Not recommended** - this re-introduces the vulnerability.

## Related Files

- `server/routes/subscriptionRoutes.ts` - Main fix location
- `server/routes/webhookRoutes.ts` - Webhook handler for activation
- `client/src/pages/subscription-settings.tsx` - Frontend integration needed
- `shared/schema.ts` - Subscription schema definitions

## Questions or Issues?

Contact the security team or create an issue in the repository.
