# Subscription System Documentation

## Overview

The Authentik project implements a comprehensive subscription-based system that controls access to features and resources based on subscription plans. The system supports multi-tenant architecture with flexible limit management, custom overrides, and detailed audit tracking.

## Architecture

### Core Components

1. **Subscription Plans** - Predefined tiers with feature limits
2. **Tenant Subscriptions** - Active subscriptions per tenant
3. **Tenant Limits** - Custom overrides for specific tenants
4. **Limit Events** - Audit trail for all limit-related activities

### Database Schema

```sql
-- Subscription Plans
subscription_plans {
  id: varchar (primary key)
  name: text (basic, professional, enterprise)
  display_name: text
  description: text
  price: decimal
  yearly_price: decimal
  stripe_price_id: text
  stripe_yearly_price_id: text
  features: text[]
  max_users: integer
  max_projects: integer
  max_shops: integer
  storage_limit: integer
  support_level: text
  trial_days: integer
  is_popular: boolean
  is_active: boolean
  sort_order: integer
}

-- Active Subscriptions
subscriptions {
  id: varchar (primary key)
  tenant_id: varchar (foreign key)
  user_id: varchar (foreign key)
  plan_id: varchar (foreign key)
  stripe_subscription_id: text
  stripe_customer_id: text
  status: text
  current_period_start: timestamp
  current_period_end: timestamp
  trial_start: timestamp
  trial_end: timestamp
  cancel_at_period_end: boolean
  canceled_at: timestamp
  is_yearly: boolean
}

-- Custom Tenant Limits
tenant_limits {
  id: varchar (primary key)
  tenant_id: varchar (foreign key, unique)
  max_shops: integer
  max_users: integer
  max_storage_gb: integer
  custom_limits: text (JSON)
  override_reason: text
  created_by: varchar (foreign key)
  expires_at: timestamp
  is_active: boolean
}

-- Audit Trail
shop_limit_events {
  id: varchar (primary key)
  tenant_id: varchar (foreign key)
  event_type: text
  shop_count: integer
  limit_value: integer
  subscription_plan_id: varchar (foreign key)
  custom_limit_id: varchar (foreign key)
  metadata: text (JSON)
  created_at: timestamp
}
```

## Subscription Plans

### Default Plans

#### Basic Plan
- **Price**: $29.99/month, $299.99/year
- **Shop Limit**: 5 shops
- **User Limit**: 10 users
- **Storage**: 10GB
- **Support**: Email support
- **Features**:
  - Up to 5 shops
  - Up to 10 users
  - Basic email support
  - 10GB storage
  - Standard analytics

#### Professional Plan
- **Price**: $79.99/month, $799.99/year
- **Shop Limit**: 10 shops
- **User Limit**: 25 users
- **Storage**: 50GB
- **Support**: Priority email support
- **Features**:
  - Up to 10 shops
  - Up to 25 users
  - Priority email support
  - 50GB storage
  - Advanced analytics
  - Custom branding

#### Enterprise Plan
- **Price**: $199.99/month, $1999.99/year
- **Shop Limit**: 20 shops
- **User Limit**: Unlimited
- **Storage**: 200GB
- **Support**: Dedicated support
- **Features**:
  - Up to 20 shops
  - Unlimited users
  - Dedicated support
  - 200GB storage
  - Premium analytics
  - Custom integrations
  - White-label options

## Limit Enforcement

### Shop Limits

The system enforces shop creation limits based on the active subscription plan or custom tenant limits.

#### Limit Resolution Priority

1. **Custom Tenant Limits** (highest priority)
   - Active custom limits with valid expiration
   - Overrides subscription plan limits
   - Can be temporary or permanent

2. **Subscription Plan Limits**
   - Limits defined in the active subscription plan
   - Applied when no custom limits exist

3. **Default Limits** (fallback)
   - 5 shops for tenants without subscriptions
   - Ensures system always has enforceable limits

#### Implementation

```typescript
// Check effective shop limit
const limits = await storage.checkShopLimits(tenantId);

// Validate before shop creation
await storage.validateShopCreation(tenantId);

// Response structure
interface ShopLimits {
  currentShops: number;
  maxShops: number | null;
  canAddShop: boolean;
  planName: string;
  isCustomLimit?: boolean;
  customLimitReason?: string;
  expiresAt?: Date;
}
```

### Database Functions

The system includes PostgreSQL functions for efficient limit checking:

```sql
-- Get effective shop limit for a tenant
SELECT get_effective_shop_limit('tenant-id');

-- Check if tenant can add more shops
SELECT can_tenant_add_shop('tenant-id');
```

## Custom Tenant Limits

### Use Cases

1. **Special Customers**: Higher limits for enterprise clients
2. **Promotional Offers**: Temporary limit increases
3. **Grandfathered Plans**: Maintaining legacy limits
4. **Trial Extensions**: Extended trial periods

### Management

#### Creating Custom Limits

```bash
POST /api/tenant-limits/:tenantId
{
  "maxShops": 15,
  "overrideReason": "Special enterprise customer",
  "expiresAt": "2024-12-31T23:59:59Z"
}
```

#### Updating Limits

```bash
PUT /api/tenant-limits/:tenantId
{
  "maxShops": 20,
  "overrideReason": "Upgraded to premium support"
}
```

#### Removing Custom Limits

```bash
DELETE /api/tenant-limits/:tenantId
```

### Expiration Handling

- Custom limits can have expiration dates
- Expired limits automatically revert to subscription plan limits
- System checks expiration on every limit validation
- Audit events track limit expirations

## API Endpoints

### Subscription Management

```bash
# Get subscription plans
GET /api/subscription-plans

# Get tenant subscription
GET /api/subscriptions/tenant/:tenantId

# Create subscription
POST /api/subscriptions

# Update subscription
PUT /api/subscriptions/:id
```

### Limit Management

```bash
# Get current limits and usage
GET /api/tenant-limits/:tenantId

# Create/update custom limits
POST /api/tenant-limits/:tenantId

# Update existing limits
PUT /api/tenant-limits/:tenantId

# Remove custom limits
DELETE /api/tenant-limits/:tenantId

# Get limit events (audit trail)
GET /api/tenant-limits/:tenantId/events

# Get usage summary
GET /api/tenant-limits/:tenantId/summary
```

### Shop Management

```bash
# Get shop limits
GET /api/shops/limits

# Create shop (with limit validation)
POST /api/shops

# Get shops with limit info
GET /api/shops
```

## Event Tracking

### Event Types

- `limit_reached`: When current usage equals the limit
- `limit_exceeded`: When attempting to exceed the limit
- `limit_increased`: When limits are raised
- `limit_decreased`: When limits are lowered
- `shop_created`: When a new shop is created
- `shop_deleted`: When a shop is deleted

### Event Structure

```typescript
interface ShopLimitEvent {
  id: string;
  tenantId: string;
  eventType: ShopLimitEventType;
  shopCount: number;
  limitValue?: number;
  subscriptionPlanId?: string;
  customLimitId?: string;
  metadata: string; // JSON
  createdAt: Date;
}
```

### Analytics

Events can be used for:
- Usage analytics and reporting
- Billing and metering
- Customer success insights
- Compliance and audit requirements

## Frontend Integration

### Shop Creation UI

- Displays current shop usage and limits
- Shows visual progress bars for limit utilization
- Disables "Add Shop" button when limit is reached
- Displays warning messages for approaching limits

### Limit Display

```typescript
// Example limit display
interface LimitDisplay {
  current: number;    // 3
  max: number;       // 5
  remaining: number; // 2
  planName: string;  // "Professional Plan"
  isCustom: boolean; // false
}
```

### Error Handling

- Graceful error messages when limits are exceeded
- Suggestions for plan upgrades
- Clear indication of custom limit expiration

## Stripe Integration

### Webhook Handling

- Subscription created/updated events
- Payment success/failure events
- Subscription cancellation events
- Trial period events

### Price Management

- Stripe Price IDs stored in subscription plans
- Support for both monthly and yearly pricing
- Automatic price updates from Stripe

## Security Considerations

### Access Control

- Only Owners and Administrators can manage limits
- Tenant isolation enforced at database level
- API endpoints require proper authentication

### Audit Trail

- All limit changes are logged
- User attribution for all modifications
- Immutable event history
- Compliance-ready audit logs

### Input Validation

- Zod schemas for all API inputs
- Sanitization of text fields
- Type safety throughout the system

## Migration and Setup

### Database Migration

```bash
# Run the enhanced shop limits migration
npx tsx server/run-shop-limits-migration.ts
```

### Initial Setup

```bash
# Set up default subscription plans
npx tsx server/setup-subscription-plans.ts
```

### Environment Variables

```bash
DATABASE_URL=postgresql://user:password@localhost:5432/authentik
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
JWT_SECRET=your-jwt-secret
```

## Monitoring and Maintenance

### Health Checks

- Monitor subscription sync with Stripe
- Check for expired custom limits
- Validate limit enforcement accuracy

### Performance Optimization

- Database indexes on frequently queried fields
- Efficient limit checking with PostgreSQL functions
- Caching of subscription plan data

### Backup and Recovery

- Regular database backups
- Subscription data synchronization
- Event log preservation

## Future Enhancements

### Planned Features

1. **Usage-Based Billing**: Metered pricing for API calls
2. **Feature Flags**: Granular feature control per plan
3. **Multi-Resource Limits**: Beyond shops (projects, users, storage)
4. **Self-Service Upgrades**: Customer-initiated plan changes
5. **Usage Alerts**: Proactive notifications for approaching limits

### Extensibility

- Plugin system for custom limit types
- Webhook system for external integrations
- API for third-party billing systems
- Custom reporting and analytics

## Troubleshooting

### Common Issues

1. **Limit Not Enforced**
   - Check subscription status
   - Verify custom limits expiration
   - Review database function execution

2. **Incorrect Limit Display**
   - Refresh subscription data
   - Check tenant limit overrides
   - Verify API response structure

3. **Event Logging Failures**
   - Check database connectivity
   - Review error logs
   - Verify event schema compliance

### Debug Commands

```bash
# Check tenant limits
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/tenant-limits/tenant-123

# Get limit events
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/tenant-limits/tenant-123/events

# Test limit functions
psql -d authentik -c "SELECT get_effective_shop_limit('tenant-123');"
```

## Conclusion

The subscription system provides a robust, scalable foundation for SaaS billing and resource management. With comprehensive audit trails, flexible custom limits, and strong security controls, it supports both simple subscription models and complex enterprise requirements.

For additional support or questions, refer to the API documentation or contact the development team.